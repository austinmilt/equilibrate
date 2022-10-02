use anchor_lang::{prelude::*, AccountsClose};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{GAME_SEED, PLAYER_SEED, POOL_MANAGER_SEED},
    id,
    model::EquilibrateError,
    state::{game::Game, PlayerState, PoolManager},
};

#[derive(Accounts)]
pub struct LeaveGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED.as_ref(), &game.id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    /// CHECK: wallet to which rent should be returned when closing the game account, which must be the same wallet used to make the game
    #[account(
        mut,
        constraint = game_creator.key() == game.creator
        @EquilibrateError::GameCreatorMismatch
    )]
    pub game_creator: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [PLAYER_SEED.as_ref(), game.key().as_ref(), payer.key().as_ref()],
        bump,
        owner = id(),
        close = payer,
    )]
    pub player: Account<'info, PlayerState>,

    #[account(
        mut,
        token::mint = game.config.mint,
        token::authority = payer,
    )]
    pub winnings_destination_account: Account<'info, TokenAccount>,

    pub pool_manager: Account<'info, PoolManager>,

    #[account(
        mut,
        token::mint = game.config.mint,
    )]
    pub token_pool: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn leave_game(ctx: Context<LeaveGame>) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    // check constraints
    let game_player_count: u64 = ctx.accounts.game.get_player_count();

    // This is untestable since the last person leaving the game
    // also results in the game account being deleted. However, we'll
    // leave it in for completeness.
    require_gt!(game_player_count, 0u64, EquilibrateError::GameIsOver);

    PoolManager::validate_token_pool(
        &ctx.accounts.token_pool,
        ctx.accounts.pool_manager.key(),
        ctx.accounts.game.config.mint,
    )?;

    // update bucket balances and remove player and their winnings from their bucket
    let winnings: u64;
    let game = &mut ctx.accounts.game;
    if game_player_count == 1 {
        // if this is the player to end the game, give them all the remaining tokens
        winnings = game.state.buckets.iter().map(|b| b.decimal_tokens).sum();
    } else {
        game.update_bucket_balances(now_epoch_seconds.try_into().unwrap());
        let i_current = ctx.accounts.player.bucket as usize;
        winnings = game.state.buckets[i_current]
            .decimal_tokens
            .checked_div(game.state.buckets[i_current].players.into())
            .unwrap();
        game.state.buckets[i_current].decimal_tokens = game.state.buckets[i_current]
            .decimal_tokens
            .checked_sub(winnings)
            .unwrap();
        game.state.buckets[0].players = game.state.buckets[0].players.checked_sub(1).unwrap();
        game.state.buckets[i_current].players = game.state.buckets[i_current]
            .players
            .checked_sub(1)
            .unwrap();
    }
    game.state.last_update_epoch_seconds = now_epoch_seconds;

    // transfer game tokens from pool account
    let winnings_transfer_accounts = Transfer {
        from: ctx.accounts.token_pool.to_account_info(),
        to: ctx.accounts.winnings_destination_account.to_account_info(),
        authority: ctx.accounts.pool_manager.to_account_info(),
    };
    let token_program = ctx.accounts.token_program.to_account_info();
    let mint = game.config.mint.key();
    let seeds = &[
        POOL_MANAGER_SEED.as_ref(),
        mint.as_ref(),
        &[ctx.accounts.pool_manager.bump],
    ];
    let signer = &[&seeds[..]];
    let winnings_transfer_context =
        CpiContext::new_with_signer(token_program, winnings_transfer_accounts, signer);
    token::transfer(winnings_transfer_context, winnings)?;

    ctx.accounts.player.log_leave(winnings);

    // close the game and return rent to the game creator
    if game_player_count == 1 {
        game.close(ctx.accounts.game_creator.to_account_info())?;
        game.log_end();
    }

    Ok(())
}

use anchor_lang::{prelude::*, AccountsClose};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{GAME_SEED, PLAYER_SEED},
    id,
    model::EquilibrateError,
    state::{game::Game, PlayerState},
};

#[derive(Accounts)]
pub struct LeaveGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED.as_ref(), &game.id.to_le_bytes()],
        bump,
        constraint = game.creator == game_creator.key()
    )]
    pub game: Account<'info, Game>,

    /// CHECK: wallet to which rent should be returned when closing the game account, which must be the same wallet used to make the game
    #[account(mut)]
    pub game_creator: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [PLAYER_SEED.as_ref(), game.key().as_ref(), payer.key().as_ref()],
        bump,
        owner = id(),
        close = payer,
        constraint = player.game.key() == game.key()
        @EquilibrateError::InvalidPlayerState
    )]
    pub player: Account<'info, PlayerState>,

    #[account(
        mut,

        constraint = winnings_destination_account.mint == game.config.mint.key()
        @EquilibrateError::InvalidTokenSourceMint,

        owner = token::ID,
    )]
    pub winnings_destination_account: Account<'info, TokenAccount>,

    #[account(
        mut,

        constraint = token_pool.mint == game.config.mint
        @EquilibrateError::InvalidPoolMint,

        constraint = token_pool.owner == id()
        @EquilibrateError::InvalidPoolOwner,

        owner = token::ID,
    )]
    pub token_pool: Account<'info, TokenAccount>,

    /// CHECK: The program itself and authority for transfering tokens out of the pool
    #[account(
        executable,
        constraint = equilibrate_program.key() == id()
        @EquilibrateError::InvalidProgramId
    )]
    pub equilibrate_program: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn leave_game(ctx: Context<LeaveGame>) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    let game = &mut ctx.accounts.game;

    // check constraints
    let game_player_count: u64 = game.state.buckets.iter().map(|b| b.players as u64).sum();
    require_gt!(game_player_count, 0u64, EquilibrateError::GameIsOver);

    // update bucket balances and remove player and their winnings from their bucket
    let mut winnings: u64 = 0;
    let mut found_winnings: bool = false;
    if game_player_count == 1 {
        // if they are the player to end the game, give them all the remaining tokens
        winnings = game.state.buckets.iter().map(|b| b.decimal_tokens).sum();
        found_winnings = true;
    } else {
        let new_balances = game.compute_buckets_new_balance(now_epoch_seconds.try_into().unwrap());
        let mut state = game.state.clone();
        let player_bucket_usize = ctx.accounts.player.bucket as usize;
        for (i, bucket) in state.buckets.iter_mut().enumerate() {
            let balance_basis = new_balances.get(i).unwrap();
            if i == player_bucket_usize {
                // player takes balance of bucket proportional to their representation
                // of the population in the bucket
                found_winnings = true;
                winnings = balance_basis.checked_div(bucket.players.into()).unwrap();
                bucket.players = bucket.players.checked_sub(1).unwrap();
                bucket.decimal_tokens = balance_basis.checked_sub(winnings).unwrap()
            } else {
                bucket.decimal_tokens = *balance_basis;
            }
        }
        state.last_update_epoch_seconds = now_epoch_seconds;
        game.state = state;
    }

    require!(found_winnings, EquilibrateError::CouldNotFindPlayer);

    // transfer game tokens from pool account
    let pool_transfer_accounts = Transfer {
        from: ctx.accounts.token_pool.to_account_info(),
        to: ctx.accounts.winnings_destination_account.to_account_info(),
        authority: ctx.accounts.equilibrate_program.to_account_info(),
    };
    let token_program = ctx.accounts.token_program.to_account_info();
    let pool_transfer_context = CpiContext::new(token_program, pool_transfer_accounts);
    token::transfer(pool_transfer_context, winnings)?;

    ctx.accounts.player.log_leave(winnings);

    // close the game and return rent to the game creator
    if game_player_count == 1 {
        game.close(ctx.accounts.game_creator.to_account_info())?;

        game.log_end();
    }

    Ok(())
}

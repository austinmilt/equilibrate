use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{GAME_SEED, PLAYER_SEED, PROGRAM_FEE_DESTINATION, PROGRAM_FEE_LAMPORTS},
    id,
    model::EquilibrateError,
    state::{game::Game, PlayerState},
};

#[derive(Accounts)]
pub struct EnterGame<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED.as_ref(), &game.id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        init,
        payer = payer,
        space = PlayerState::get_space(),
        seeds = [PLAYER_SEED.as_ref(), game.key().as_ref(), payer.key().as_ref()],
        bump,
        owner = id(),
    )]
    pub player: Account<'info, PlayerState>,

    /// CHECK: wallet where the program fee should be deposited
    #[account(
        mut,
        constraint = program_fee_destination.key().as_ref() == PROGRAM_FEE_DESTINATION
        @EquilibrateError::InvalidProgramFeeDestination
    )]
    pub program_fee_destination: AccountInfo<'info>,

    #[account(
        mut,

        constraint = deposit_source_account.mint == game.config.mint.key()
        @EquilibrateError::InvalidTokenSourceMint,

        owner = token::ID,
    )]
    pub deposit_source_account: Account<'info, TokenAccount>,

    #[account(
        mut,

        constraint = token_pool.mint == game.config.mint
        @EquilibrateError::InvalidPoolMint,

        constraint = token_pool.owner == id()
        @EquilibrateError::InvalidPoolOwner,

        owner = token::ID,
    )]
    pub token_pool: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn enter_game(ctx: Context<EnterGame>, i_bucket: u64) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    let config = &ctx.accounts.game.config.clone();

    // check constraints
    require_gt!(
        // there is one more bucket than the creator configures: the holding bucket
        (config.n_buckets + 1),
        i_bucket,
        EquilibrateError::BucketDoesNotExist
    );

    require_gt!(i_bucket, 0u64, EquilibrateError::CannotEnterHoldingBucket);

    let game_player_count: u64 = ctx
        .accounts
        .game
        .state
        .buckets
        .iter()
        .map(|b| b.players as u64)
        .sum();
    require_gt!(game_player_count, 0u64, EquilibrateError::GameIsOver);

    require_gt!(
        config.max_players,
        game_player_count,
        EquilibrateError::GameAtCapacity
    );

    // take program fee
    let program_fee_transfer_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.program_fee_destination.clone(),
        },
    );
    system_program::transfer(program_fee_transfer_context, PROGRAM_FEE_LAMPORTS)?;

    // transfer game tokens to pool account
    let pool_transfer_accounts = Transfer {
        from: ctx.accounts.deposit_source_account.to_account_info(),
        to: ctx.accounts.token_pool.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let token_program = ctx.accounts.token_program.to_account_info();
    let pool_transfer_context = CpiContext::new(token_program, pool_transfer_accounts);
    token::transfer(pool_transfer_context, config.entry_fee_decimal_tokens)?;

    // update bucket balances and insert player into desired bucket
    let game = &mut ctx.accounts.game;
    game.update_bucket_balances(now_epoch_seconds.try_into().unwrap());
    game.state.buckets[0].players = game.state.buckets[0].players.checked_add(1).unwrap();
    game.state.buckets[0].decimal_tokens = game.state.buckets[0]
        .decimal_tokens
        .checked_add(config.entry_fee_decimal_tokens)
        .unwrap();
    game.state.buckets[i_bucket as usize].players = game.state.buckets[i_bucket as usize]
        .players
        .checked_add(1)
        .unwrap();

    // create player state account
    let player = &mut ctx.accounts.player;
    player.set_inner(PlayerState {
        game: ctx.accounts.game.key(),
        bucket: i_bucket,
    });
    player.log_make();

    Ok(())
}

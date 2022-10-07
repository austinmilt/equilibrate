use anchor_lang::{prelude::*, system_program};
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::{
    constants::{GAME_SEED, PLAYER_SEED, PROGRAM_FEE_DESTINATION, PROGRAM_FEE_LAMPORTS},
    id,
    model::EquilibrateError,
    state::{game::Game, PlayerState, PoolManager},
};

#[derive(Accounts)]
#[instruction(pool_manager: Pubkey)]
pub struct EnterGame<'info> {
    /// game account of the game being played
    #[account(
        mut,
        seeds = [GAME_SEED.as_ref(), &game.id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    /// player state account of the new player
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

    /// player's token acount from which their entry deposit is taken
    #[account(
        mut,
        token::mint = game.config.mint
    )]
    pub deposit_source_account: Account<'info, TokenAccount>,

    /// token pool of the mint/game
    #[account(
        mut,
        token::mint = game.config.mint,
    )]
    pub token_pool: Account<'info, TokenAccount>,

    /// payer for creating player state, must be the player
    #[account(mut)]
    pub payer: Signer<'info>,

    /// standard SPL token program, for transferring token deposit
    pub token_program: Program<'info, Token>,

    /// standard rent sysvar, for determining rent for created accounts
    pub rent: Sysvar<'info, Rent>,

    /// standard system program, for creating accounts
    pub system_program: Program<'info, System>,
}

pub fn enter_game(ctx: Context<EnterGame>, i_bucket: u8, pool_manager: Pubkey) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    let config = &ctx.accounts.game.config.clone();

    // check constraints
    require_gt!(
        // there is one more bucket than the creator configures: the holding bucket
        (config.n_buckets + 1),
        i_bucket,
        EquilibrateError::BucketDoesNotExist
    );

    require_gt!(i_bucket, 0u8, EquilibrateError::CannotEnterHoldingBucket);

    PoolManager::validate_token_pool(&ctx.accounts.token_pool, pool_manager, config.mint)?;

    // This is untestable since the last person leaving the game
    // also results in the game account being deleted. However, we'll
    // leave it in for completeness.
    let game_player_count = ctx.accounts.game.get_player_count();

    require_gt!(game_player_count, 0, EquilibrateError::GameIsOver);

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
    game.state.last_update_epoch_seconds = now_epoch_seconds;

    // create player state account
    let player = &mut ctx.accounts.player;
    player.set_inner(PlayerState { bucket: i_bucket });
    player.log_make();

    Ok(())
}

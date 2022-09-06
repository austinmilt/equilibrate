use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{GAME_SEED, PLAYER_SEED, PROGRAM_FEE_DESTINATION, PROGRAM_FEE_LAMPORTS},
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
        owner = equilibrate_program_id.key(),
        constraint = player.game.key() == game.key()
    )]
    pub player: Account<'info, PlayerState>,

    #[account(
        mut,
        constraint = program_fee_destination.key().as_ref() == PROGRAM_FEE_DESTINATION
    )]
    pub program_fee_destination: AccountInfo<'info>,

    #[account(
        mut,
        constraint = deposit_source_account.mint == game.config.token.key(),
        owner = token::ID,
    )]
    pub deposit_source_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = token_pool.owner == equilibrate_program_id.key(),
        token::mint = game.config.token.key(),
        token::authority = equilibrate_program_id,
        owner = token::ID,
    )]
    pub token_pool: Account<'info, TokenAccount>,

    #[account(executable)]
    pub equilibrate_program_id: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn enter_game(ctx: Context<EnterGame>, i_bucket: usize) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    let game = &mut ctx.accounts.game;
    let config = &game.config;

    // check constraints
    require_gt!(
        config.n_buckets,
        i_bucket,
        EquilibrateError::BucketDoesNotExist
    );

    let game_player_count: u64 = game.state.buckets.iter().map(|b| b.players as u64).sum();
    require_gt!(game_player_count, 0u64, EquilibrateError::GameIsOver);

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
    let new_balances = game.compute_buckets_new_balance(now_epoch_seconds.try_into().unwrap());
    let mut state = game.state.clone();
    for (i, bucket) in state.buckets.iter_mut().enumerate() {
        let balance_basis = new_balances.get(i).unwrap();
        if i == i_bucket {
            bucket.players = bucket.players.checked_add(1).unwrap();
            bucket.decimal_tokens = balance_basis
                .checked_add(config.entry_fee_decimal_tokens)
                .unwrap()
        } else {
            bucket.decimal_tokens = *balance_basis;
        }
    }
    state.last_update_epoch_seconds = now_epoch_seconds;
    game.state = state;

    // create player state account
    let player = &mut ctx.accounts.player;
    player.set_inner(PlayerState {
        game: game.key(),
        // first player always goes into the first bucket
        bucket: i_bucket,
    });
    player.log_make();

    Ok(())
}

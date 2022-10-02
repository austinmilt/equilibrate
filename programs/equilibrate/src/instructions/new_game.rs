use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Token, TokenAccount, Transfer},
};

use crate::{
    constants::{
        GAME_MAX_BUCKETS, GAME_SEED, PLAYER_SEED, PROGRAM_FEE_DESTINATION, PROGRAM_FEE_LAMPORTS,
    },
    model::EquilibrateError,
    state::{
        game::{Bucket, Game, GameConfig, GameState},
        PlayerState, PoolManager,
    },
};

#[derive(Accounts)]
#[instruction(config: GameConfig, game_id: u64, pool_manager: Pubkey)]
pub struct NewGame<'info> {
    #[account(
        init,
        payer = payer,
        space = Game::get_space(config.n_buckets),
        seeds = [GAME_SEED.as_ref(), &game_id.to_le_bytes()],
        bump,
    )]
    pub game: Account<'info, Game>,

    #[account(
        init,
        payer = payer,
        space = PlayerState::get_space(),
        seeds = [PLAYER_SEED.as_ref(), game.key().as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub first_player: Account<'info, PlayerState>,

    /// CHECK: wallet where the program fee should be deposited
    #[account(
        mut,
        constraint = program_fee_destination.key().as_ref() == PROGRAM_FEE_DESTINATION
        @EquilibrateError::InvalidProgramFeeDestination
    )]
    pub program_fee_destination: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = config.mint,
    )]
    pub deposit_source_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = config.mint,
        token::authority = pool_manager,
    )]
    pub token_pool: Account<'info, TokenAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn new_game(
    ctx: Context<NewGame>,
    config: GameConfig,
    game_id: u64,
    pool_manager: Pubkey,
) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    require_gt!(
        config.entry_fee_decimal_tokens,
        0,
        EquilibrateError::InvalidEntryFee
    );
    require_gt!(config.n_buckets, 1, EquilibrateError::TooFewBuckets);
    require!(
        config.n_buckets <= GAME_MAX_BUCKETS,
        EquilibrateError::TooManyBuckets
    );

    require_gt!(
        config.spill_rate_decimal_tokens_per_second_per_player,
        0,
        EquilibrateError::InvalidSpillRate
    );
    require_gt!(config.max_players, 1, EquilibrateError::InvalidMaxPlayers);

    PoolManager::validate_token_pool(&ctx.accounts.token_pool, pool_manager, config.mint)?;

    let program_fee_transfer_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.program_fee_destination.clone(),
        },
    );
    system_program::transfer(program_fee_transfer_context, PROGRAM_FEE_LAMPORTS)?;

    let pool_transfer_accounts = Transfer {
        from: ctx.accounts.deposit_source_account.to_account_info(),
        to: ctx.accounts.token_pool.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let token_program = ctx.accounts.token_program.to_account_info();
    let pool_transfer_context = CpiContext::new(token_program, pool_transfer_accounts);
    token::transfer(pool_transfer_context, config.entry_fee_decimal_tokens)?;

    let mut buckets = vec![
        // first bucket is the holding bucket, where fees live until they
        // have been distributed over the other buckets
        Bucket {
            // entry fee is held in the holding bucket and distributed to
            // other buckets as the game progresses
            decimal_tokens: config.entry_fee_decimal_tokens,

            // the number of players in the holding bucket is always
            // the number of players in the game (to adjust how fast
            // tokens leave this bucket)
            players: 1,
        },
        // second bucket is the first one that players can enter
        // and this is the one that the first player always enters
        Bucket {
            decimal_tokens: 0,
            players: 1,
        },
    ];

    // remaining buckets are initialized to empty since no one
    // goes into these buckets at the beginning of the game
    for _ in 2..(config.n_buckets + 1) {
        buckets.push(Bucket {
            decimal_tokens: 0,
            players: 0,
        });
    }

    let state = GameState {
        buckets,
        last_update_epoch_seconds: now_epoch_seconds,
    };

    let game = &mut ctx.accounts.game;
    game.set_inner(Game {
        config,
        state,
        id: game_id,
        creator: ctx.accounts.payer.key(),
    });
    game.log_make();

    let player = &mut ctx.accounts.first_player;
    player.set_inner(PlayerState {
        // first player always goes into the first bucket
        bucket: 0,
    });
    player.log_make();

    Ok(())
}

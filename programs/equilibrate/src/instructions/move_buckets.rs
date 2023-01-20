use anchor_lang::prelude::*;

use crate::{
    constants::{GAME_SEED, PLAYER_SEED},
    id,
    model::EquilibrateError,
    state::{game::Game, PlayerState},
};

#[derive(Accounts)]
pub struct MoveBuckets<'info> {
    /// game account of the game being played
    #[account(
        mut,
        seeds = [GAME_SEED.as_ref(), &game.id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    /// player state account of the moving player
    #[account(
        mut,
        seeds = [PLAYER_SEED.as_ref(), game.key().as_ref(), payer.key().as_ref()],
        bump,
        owner = id()
    )]
    pub player: Account<'info, PlayerState>,

    /// payer for paying moving transaction fee
    #[account(mut)]
    pub payer: Signer<'info>,
}

pub fn move_buckets(ctx: Context<MoveBuckets>, i_bucket: u8) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    // check constraints
    require_neq!(
        ctx.accounts.player.bucket,
        i_bucket,
        EquilibrateError::AlreadyInBucket
    );

    require_gt!(
        // there is one more bucket than the creator configures: the holding bucket
        ctx.accounts.game.state.buckets.len(),
        i_bucket as usize,
        EquilibrateError::BucketDoesNotExist
    );

    require_gt!(i_bucket, 0, EquilibrateError::CannotEnterHoldingBucket);

    let game = &mut ctx.accounts.game;
    let game_player_count = game.get_player_count();
    require_gt!(game_player_count, 0, EquilibrateError::GameIsOver);

    // update bucket balances and move player to their new bucket
    game.update_bucket_balances(now_epoch_seconds.try_into().unwrap());
    let i_current = ctx.accounts.player.bucket as usize;
    game.state.buckets[i_current].players = game.state.buckets[i_current]
        .players
        .checked_sub(1)
        .unwrap();
    game.state.buckets[i_bucket as usize].players = game.state.buckets[i_bucket as usize]
        .players
        .checked_add(1)
        .unwrap();
    game.state.last_update_epoch_seconds = now_epoch_seconds;

    // update player state account
    ctx.accounts.player.bucket = i_bucket;
    ctx.accounts.player.burn_penalty_decimal_tokens = ctx
        .accounts
        .player
        .burn_penalty_decimal_tokens
        .checked_add(game.config.burn_rate_decimal_tokens_per_move)
        .unwrap();
    ctx.accounts.player.log_move();

    Ok(())
}

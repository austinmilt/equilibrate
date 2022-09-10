use anchor_lang::prelude::*;

use crate::{
    constants::{GAME_SEED, PLAYER_SEED},
    id,
    model::EquilibrateError,
    state::{game::Game, PlayerState},
};

#[derive(Accounts)]
pub struct MoveBuckets<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED.as_ref(), &game.id.to_le_bytes()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [PLAYER_SEED.as_ref(), game.key().as_ref(), payer.key().as_ref()],
        bump,
        owner = id(),
        constraint = player.game.key() == game.key()
        @EquilibrateError::InvalidPlayerState
    )]
    pub player: Account<'info, PlayerState>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

pub fn move_buckets(ctx: Context<MoveBuckets>, i_bucket: u64) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    let game = &mut ctx.accounts.game;
    let config = &game.config;

    // check constraints
    require_neq!(
        ctx.accounts.player.bucket,
        i_bucket,
        EquilibrateError::AlreadyInBucket
    );

    require_gt!(
        config.n_buckets,
        i_bucket,
        EquilibrateError::BucketDoesNotExist
    );

    let game_player_count: u64 = game.state.buckets.iter().map(|b| b.players as u64).sum();
    require_gt!(game_player_count, 0u64, EquilibrateError::GameIsOver);

    // update bucket balances and move player to their new bucket
    let new_balances = game.compute_buckets_new_balance(now_epoch_seconds.try_into().unwrap());
    let mut state = game.state.clone();
    let i_bucket_usize = i_bucket as usize;
    let player_bucket_usize = ctx.accounts.player.bucket as usize;
    for (i, bucket) in state.buckets.iter_mut().enumerate() {
        bucket.decimal_tokens = *new_balances.get(i).unwrap();
        if i == i_bucket_usize {
            bucket.players = bucket.players.checked_add(1).unwrap();
        } else if i == player_bucket_usize {
            bucket.players = bucket.players.checked_sub(1).unwrap();
        }
    }
    state.last_update_epoch_seconds = now_epoch_seconds;
    game.state = state;

    ctx.accounts.player.log_move();

    Ok(())
}

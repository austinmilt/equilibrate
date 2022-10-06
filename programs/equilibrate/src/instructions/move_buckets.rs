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
        owner = id()
    )]
    pub player: Account<'info, PlayerState>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

pub fn move_buckets(ctx: Context<MoveBuckets>, i_bucket: u64) -> Result<()> {
    let now_epoch_seconds = Clock::get().unwrap().unix_timestamp;

    // check constraints
    require_neq!(
        ctx.accounts.player.bucket,
        i_bucket,
        EquilibrateError::AlreadyInBucket
    );

    require_gt!(
        // there is one more bucket than the creator configures: the holding bucket
        ctx.accounts.game.state.buckets.len() as u64,
        i_bucket,
        EquilibrateError::BucketDoesNotExist
    );

    require_gt!(i_bucket, 0u64, EquilibrateError::CannotEnterHoldingBucket);
    msg!("new bucket {}", i_bucket);

    let game_player_count: u64 = ctx
        .accounts
        .game
        .state
        .buckets
        .iter()
        .map(|b| b.players as u64)
        .sum();
    require_gt!(game_player_count, 0u64, EquilibrateError::GameIsOver);

    // update bucket balances and move player to their new bucket
    let game = &mut ctx.accounts.game;
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
    ctx.accounts.player.log_move();

    Ok(())
}

pub mod constants;
pub mod instructions;
pub mod model;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;
use state::*;

declare_id!("Equi1CUTu17WagNVmpFq4SvcqvrEeNYWqqgzw4MppmjS");

#[program]
pub mod equilibrate {
    use super::*;

    pub fn new_game(ctx: Context<NewGame>, config: GameConfig, game_id: u64) -> Result<()> {
        instructions::new_game(ctx, config, game_id)
    }

    pub fn enter_game(ctx: Context<EnterGame>, bucket: usize) -> Result<()> {
        instructions::enter_game(ctx, bucket)
    }

    pub fn move_buckets(ctx: Context<MoveBuckets>, bucket: usize) -> Result<()> {
        instructions::move_buckets(ctx, bucket)
    }

    pub fn leave_game(ctx: Context<LeaveGame>) -> Result<()> {
        instructions::leave_game(ctx)
    }
}

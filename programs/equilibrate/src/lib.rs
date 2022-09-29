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

    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        instructions::create_pool(ctx)
    }

    pub fn new_game(ctx: Context<NewGame>, config: GameConfig, game_id: u64, pool_manager: Pubkey) -> Result<()> {
        instructions::new_game(ctx, config, game_id, pool_manager)
    }

    pub fn enter_game(ctx: Context<EnterGame>, bucket: u64, pool_manager: Pubkey) -> Result<()> {
        instructions::enter_game(ctx, bucket, pool_manager)
    }

    pub fn move_buckets(ctx: Context<MoveBuckets>, bucket: u64) -> Result<()> {
        instructions::move_buckets(ctx, bucket)
    }

    pub fn leave_game(ctx: Context<LeaveGame>, pool_manager: Pubkey) -> Result<()> {
        instructions::leave_game(ctx, pool_manager)
    }
}

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

    /// Creates the token pool and pool manager used to sign token payouts from the pool.
    /// Should only be called once per game mint.
    pub fn create_pool(ctx: Context<CreatePool>, pool_manager_bump: u8) -> Result<()> {
        instructions::create_pool(ctx, pool_manager_bump)
    }

    /// Creates/starts a new game and enters the payer/player into it
    pub fn new_game(
        ctx: Context<NewGame>,
        config: GameConfig,
        game_id: u64,
        pool_manager: Pubkey,
    ) -> Result<()> {
        instructions::new_game(ctx, config, game_id, pool_manager)
    }

    /// Enters the player into an existing game
    pub fn enter_game(ctx: Context<EnterGame>, bucket: u8, pool_manager: Pubkey) -> Result<()> {
        instructions::enter_game(ctx, bucket, pool_manager)
    }

    /// Moves the player from one bucket into another. Trying to move into the same
    /// bucket the player is already in will result in a failure.
    pub fn move_buckets(ctx: Context<MoveBuckets>, bucket: u8) -> Result<()> {
        instructions::move_buckets(ctx, bucket)
    }

    /// Leaves the game, transferring any winnings into the player's token account
    /// The last player to leave gets all the unclaimed tokens in the game.
    pub fn leave_game(ctx: Context<LeaveGame>) -> Result<()> {
        instructions::leave_game(ctx)
    }
}

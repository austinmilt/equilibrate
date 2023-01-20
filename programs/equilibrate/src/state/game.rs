use std::{cmp::min, mem::replace};

use anchor_lang::prelude::*;

#[account]
#[derive(Debug, PartialEq)]
pub struct Game {
    pub version: u8,
    pub id: u64,
    pub creator: Pubkey,
    pub config: GameConfig,
    pub state: GameState,
}

impl Game {
    pub fn get_space(n_buckets_configured: u8) -> usize {
        8 + // account discriminator
        1 + // version
        8 + // id
        32 + // creator
        GameConfig::get_space() +
        GameState::get_space(n_buckets_configured)
    }

    pub fn update_bucket_balances(&mut self, now_epoch_seconds: u64) {
        let seconds_since_last_update = now_epoch_seconds
            .checked_sub(self.state.last_update_epoch_seconds.try_into().unwrap())
            .unwrap();

        // compute the spillover from each bucket, then
        // equally distribute that across other buckets
        let n_buckets_including_holding = self.state.buckets.len();
        let mut inflow: Vec<u64> = vec![0; n_buckets_including_holding];
        let mut outflow: Vec<u64> = vec![0; n_buckets_including_holding];

        let bucket_players = self
            .state
            .buckets
            .iter()
            .map(|b| b.players)
            .collect::<Vec<u16>>();

        let buckets = &mut self.state.buckets;
        for i in 0..n_buckets_including_holding {
            let bucket = &mut buckets[i];
            let spillover_i_desired = bucket.compute_spillover(
                self.config.spill_rate_decimal_tokens_per_second_per_player,
                seconds_since_last_update,
            );
            // only spill over to buckets with fewer players than this one
            let target_indices = (0..n_buckets_including_holding)
                .collect::<Vec<usize>>()
                .into_iter()
                .filter_map(|j| {
                    if (j != 0) && (j != i) && (&bucket_players[j] < &bucket.players) {
                        Some(j)
                    } else {
                        None
                    }
                })
                .collect::<Vec<usize>>();

            let target_count = target_indices.len() as u64;
            let spillover_to_j = match target_count {
                0 => 0,
                _ => spillover_i_desired.checked_div(target_count).unwrap(),
            };
            // Ideally spillover_i_desired and spillover_i would be equal. However, because
            // spillover_to_j uses integer division, the cumulative spillover from i to other
            // buckets (spillover_to_j) will in general be less than than the desired amount
            // (spillover_i_desired). Thus, the final spillover_i should take into account
            // how  much is actually going into other buckets.
            let spillover_i = spillover_to_j.checked_mul(target_count).unwrap();
            outflow[i] = spillover_i;
            for j in target_indices {
                let inflow_j = inflow[j].checked_add(spillover_to_j).unwrap();
                let _ = replace(&mut inflow[j], inflow_j);
            }
        }
        for i in 0..n_buckets_including_holding {
            let bucket = &mut buckets[i];
            bucket.decimal_tokens = bucket
                .decimal_tokens
                .checked_add(inflow[i])
                .unwrap()
                .checked_sub(outflow[i])
                .unwrap();
        }
    }

    pub fn get_player_count(&self) -> u16 {
        self.state
            .buckets
            .iter()
            .map(|b| b.players)
            .sum::<u16>()
            .checked_div(2) // with the holding bucket we are double-counting players
            .unwrap()
    }

    pub fn log_make(&self) {
        msg!("Initialized game {}", self.id);
    }

    pub fn log_end(&self) {
        msg!("Ended game {}", self.id);
    }
}

#[derive(Debug, PartialEq, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GameConfig {
    pub mint: Pubkey,
    pub entry_fee_decimal_tokens: u64,
    pub spill_rate_decimal_tokens_per_second_per_player: u64,
    pub n_buckets: u8,
    pub max_players: u16,
    pub burn_rate_decimal_tokens_per_move: u64,
}

impl GameConfig {
    pub fn get_space() -> usize {
        32 + // token
        8 + // entry_fee_decimal_tokens
        8 + // spill_rate_decimal_tokens_per_second_per_player
        1 + // n_buckets
        8 + // max_players
        8 // burn_rate_decimal_tokens_per_move
    }
}

#[derive(Debug, PartialEq, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GameState {
    pub buckets: Vec<Bucket>,
    pub last_update_epoch_seconds: i64,
}

impl GameState {
    pub fn get_space(n_buckets_configured: u8) -> usize {
        // add 1 to the number of buckets to include the holding bucket
        4 + Bucket::get_space()*((n_buckets_configured.checked_add(1).unwrap()) as usize) + // buckets
        8 // last_update_epoch_ms
    }
}

#[derive(Debug, PartialEq, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Bucket {
    pub decimal_tokens: u64,
    /// Number of players currently occupying this bucket. For the holding bucket
    /// this will be the total number of players in the game.
    pub players: u16,
}

impl Bucket {
    pub fn get_space() -> usize {
        8 + // decimal_tokens
        2 // players
    }

    pub fn compute_spillover(
        &self,
        spill_rate: u64,
        time_elapsed_since_last_update_seconds: u64,
    ) -> u64 {
        // each bucket can lose at most the number of tokens it contains
        let desired_spillover = (self.players as u64)
            .checked_mul(spill_rate)
            .unwrap()
            .checked_mul(time_elapsed_since_last_update_seconds)
            .unwrap();
        min(self.decimal_tokens, desired_spillover)
    }
}

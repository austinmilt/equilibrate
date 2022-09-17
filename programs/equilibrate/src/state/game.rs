use std::{cmp::min, mem::replace};

use anchor_lang::prelude::*;

#[account]
#[derive(Debug, PartialEq)]
pub struct Game {
    pub config: GameConfig,
    pub state: GameState,
    pub id: u64,
    pub creator: Pubkey,
}

impl Game {
    pub fn get_space(n_buckets_configured: u64) -> usize {
        8 + // account discriminator
        GameConfig::get_space() +
        GameState::get_space(n_buckets_configured) +
        8 + // id
        32 // creator
    }

    pub fn update_bucket_balances(&mut self, now_epoch_seconds: u64) {
        let seconds_since_last_update = now_epoch_seconds
            .checked_sub(self.state.last_update_epoch_seconds.try_into().unwrap())
            .unwrap();

        // compute the spillover from each bucket, then
        // equally distribute that across other buckets
        let n_buckets = self.state.buckets.len();
        let mut inflow: Vec<u64> = vec![0; n_buckets];
        let buckets = &mut self.state.buckets;
        for i in 0..n_buckets {
            let bucket = &mut buckets[i];
            let spillover_i_desired = bucket.compute_spillover(
                self.config.spill_rate_decimal_tokens_per_second_per_player,
                seconds_since_last_update,
            );
            let spillover_to_j = match i {
                // the holding bucket spills into every other bucket, but self.config.n_buckets
                // does not include the holding bucket (so add 1)
                0 => spillover_div_peers(spillover_i_desired, self.config.n_buckets + 1),
                _ => spillover_div_peers(spillover_i_desired, self.config.n_buckets),
            };
            // Ideally spillover_i_desired and spillover_i would be equal. However, because
            // spillover_to_j uses integer division, the cumulative spillover from i to other
            // buckets (spillover_to_j) will in general be less than than the desired amount
            // (spillover_i_desired). Thus, the final spillover_i should take into account
            // how  much is actually going into other buckets.
            let spillover_i = match i {
                0 => spillover_to_j.checked_mul(self.config.n_buckets).unwrap(),
                _ => spillover_to_j
                    .checked_mul(self.config.n_buckets - 1)
                    .unwrap(),
            };
            for j in (i + 1)..n_buckets {
                let bucket = &mut buckets[j];
                let spillover_j = bucket.compute_spillover(
                    self.config.spill_rate_decimal_tokens_per_second_per_player,
                    seconds_since_last_update,
                );
                let spillover_to_i = match i {
                    // the holding bucket only flows out, not in (except for getting the entry fees)
                    0 => 0,
                    _ => spillover_div_peers(spillover_j, self.config.n_buckets),
                };
                let inflow_i = inflow[i].checked_add(spillover_to_i).unwrap();
                let inflow_j = inflow[j].checked_add(spillover_to_j).unwrap();
                let _ = replace(&mut inflow[i], inflow_i);
                let _ = replace(&mut inflow[j], inflow_j);
            }
            let bucket = &mut buckets[i];
            msg!(
                "{:?},\t\t{:?},\t\t{:?},\t\t{:?},\t\t{:?}",
                i,
                bucket.players,
                (bucket.decimal_tokens as f64) / 1e9,
                (inflow[i] as f64) / 1e9,
                (spillover_i as f64) / 1e9
            );
            bucket.decimal_tokens = bucket
                .decimal_tokens
                .checked_add(inflow[i])
                .unwrap()
                .checked_sub(spillover_i)
                .unwrap();
        }
    }

    pub fn get_player_count(&self) -> u64 {
        self.state
        .buckets
        .iter()
        .map(|b| b.players as u64)
        .sum::<u64>()
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

fn spillover_div_peers(spillover: u64, n_buckets_configured: u64) -> u64 {
    spillover
        // computing spillover to other buckets players can enter, i.e.
        // this doesnt include the holding bucket
        .checked_div(n_buckets_configured.checked_sub(1).unwrap())
        .unwrap()
}

#[derive(Debug, PartialEq, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GameConfig {
    pub mint: Pubkey,
    pub entry_fee_decimal_tokens: u64,
    pub spill_rate_decimal_tokens_per_second_per_player: u64,
    pub n_buckets: u64,
    pub max_players: u64,
}

impl GameConfig {
    pub fn get_space() -> usize {
        32 + // token
        8 + // entry_fee_decimal_tokens
        8 + // spill_rate_decimal_tokens_per_second_per_player
        8 + // n_buckets
        8 // max_players
    }
}

#[derive(Debug, PartialEq, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GameState {
    pub buckets: Vec<Bucket>,
    pub last_update_epoch_seconds: i64,
}

impl GameState {
    pub fn get_space(n_buckets_configured: u64) -> usize {
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

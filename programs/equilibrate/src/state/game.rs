use std::cmp::{max, Ordering};

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
    pub fn get_space(n_buckets: u64) -> usize {
        8 + // account discriminator
        GameConfig::get_space() +
        GameState::get_space(n_buckets) +
        8 + // id
        32 // creator
    }

    pub fn compute_buckets_new_balance(&self, now_epoch_seconds: u64) -> Vec<u64> {
        let seconds_since_last_update = now_epoch_seconds
            .checked_sub(self.state.last_update_epoch_seconds.try_into().unwrap())
            .unwrap();

        // compute the spillover from each bucket, then
        // equally distribute that across other buckets
        let mut total_spillover: u64 = 0;
        let spillover: Vec<u64> = self
            .state
            .buckets
            .iter()
            .map(|b| {
                let bucket_spillover = b.compute_spillover(
                    self.config.spill_rate_decimal_tokens_per_second_per_player,
                    seconds_since_last_update,
                );
                total_spillover = total_spillover.checked_add(bucket_spillover).unwrap();
                bucket_spillover
            })
            .collect();

        let n_other_buckets = (self.config.n_buckets - 1) as f64;
        let mut undistributed_flow: f64 = 0.0;
        let mut flow_data: Vec<(usize, f64, f64, u64)> = spillover
            .iter()
            .enumerate()
            .map(|(i, bucket_spillover)| {
                let inflow = ((total_spillover - bucket_spillover) as f64) / n_other_buckets;
                let net_desired_flow = inflow - (bucket_spillover.clone() as f64);
                let flow_floor = net_desired_flow.floor();
                let flow_remainder = net_desired_flow - flow_floor;
                undistributed_flow += flow_remainder;
                (i, net_desired_flow, flow_remainder, flow_floor as u64)
            })
            .collect();

        // since we can only store whole-number amounts in each bucket - buckets
        // already track maximum resolution of the token being gambled - let's
        // now distribute the leftover in whole amounts across buckets, opting
        // for getting each bucket as close to its desired balance as possible
        flow_data.sort_by(|a, b| {
            if a.2 < b.2 {
                // sort descending
                Ordering::Greater
            } else if a.2 > b.2 {
                Ordering::Less
            } else {
                Ordering::Equal
            }
        });

        // The total undistributed flow should always add to a whole
        // number, but just in case it doesnt due to small floating point
        // errors, we'll round down to ensure we dont try to distribute
        // more tokens than are available (the last player will still
        // get all the remaining tokens). This number will be guaranteed
        // to be less than the number of buckets since we're adding up
        // fractions less than 1 over every bucket.
        let mut undistributed_flow = undistributed_flow.floor() as u64;
        let mut flow_reconciled: Vec<(&usize, u64)> = flow_data
            .iter()
            .map(|(i, _, _, flow_floor)| {
                if undistributed_flow > 0 {
                    undistributed_flow -= 1;
                    (i, flow_floor + 1)
                } else {
                    (i, *flow_floor)
                }
            })
            .collect();
        flow_reconciled.sort_by_key(|v| v.0);

        flow_reconciled
            .into_iter()
            .map(|(i, v)| v + self.state.buckets.get(*i).unwrap().decimal_tokens)
            .collect()
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
    pub token: Pubkey,
    pub entry_fee_decimal_tokens: u64,
    pub spill_rate_decimal_tokens_per_second_per_player: u64,
    pub n_buckets: u64,
    pub max_players: u64
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
    pub fn get_space(n_buckets: u64) -> usize {
        4 + Bucket::get_space()*(n_buckets as usize) + // buckets
        8 // last_update_epoch_ms
    }
}

#[derive(Debug, PartialEq, AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Bucket {
    pub decimal_tokens: u64,
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
        max(
            self.decimal_tokens,
            (self.players as u64) * spill_rate * time_elapsed_since_last_update_seconds,
        )
    }
}

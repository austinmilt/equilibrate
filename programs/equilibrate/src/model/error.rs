use anchor_lang::prelude::*;

#[error_code]
pub enum EquilibrateError {
    #[msg("Entry fee must be positive")]
    InvalidEntryFee,

    #[msg("Number of buckets must be positive")]
    TooFewBuckets,

    #[msg("Game cannot have more than 64 buckets")]
    TooManyBuckets,

    #[msg("Game is at capacity")]
    GameAtCapacity,

    #[msg("Token spill rate must be positive")]
    InvalidSpillRate,

    #[msg("Cannot burn tokens of native mints")]
    CannotBurnNativeMint,

    #[msg("Game must allow more than 1 player")]
    MaxPlayersTooSmall,

    #[msg("Game cannot have more than 10,000 players")]
    MaxPlayersTooLarge,

    #[msg("Attempted to enter a bucket that doesnt exist")]
    BucketDoesNotExist,

    #[msg("Not allowed to enter the holding bucket (index 0)")]
    CannotEnterHoldingBucket,

    #[msg("Attempted to move within the same bucket")]
    AlreadyInBucket,

    #[msg("Attempted to enter a game that has already ended")]
    GameIsOver,

    #[msg("Program fee pubkey must be the one hard-coded in the program")]
    InvalidProgramFeeDestination,

    #[msg("Pool mint must be the one configured for the game")]
    InvalidPoolMint,

    #[msg("Pool manager must be the provided pool manager")]
    InvalidPoolManager,

    #[msg("Token pool address is incorrect")]
    InvalidTokenPool,

    #[msg("Token pool owner must be the pool manager")]
    InvalidTokenPoolOwner,

    #[msg("Pool manager owner must be this program")]
    InvalidPoolManagerOwner,

    #[msg("Token winnings acount mint must be the one configured for the game")]
    InvalidWinningsDestinationMint,

    #[msg("Token source acount mint must be the one configured for the game")]
    InvalidTokenSourceMint,

    #[msg("Mint being burned must be the one configured for the game")]
    InvalidBurnMint,

    #[msg("Program ID must be this program")]
    InvalidProgramId,

    #[msg("Given gameCreator doesnt match the one that created the game")]
    GameCreatorMismatch,

    #[msg("Player chose to abort leaving rather than lose tokens")]
    AbortLeaveOnLoss,
}

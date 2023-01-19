export type Equilibrate = {
  "version": "0.1.0",
  "name": "equilibrate",
  "instructions": [
    {
      "name": "createPool",
      "docs": [
        "Creates the token pool and pool manager used to sign token payouts from the pool.",
        "Should only be called once per game mint."
      ],
      "accounts": [
        {
          "name": "poolManager",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "account that signs for token payouts from the token pool"
          ]
        },
        {
          "name": "tokenPool",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "token pool for all games played with `game_mint`"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "payer to create the token pool and pool manager accounts"
          ]
        },
        {
          "name": "gameMint",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "mint of the token pool for all games of this mint"
          ]
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard SPL token program, for creating the token pool"
          ]
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard rent sysvar, for determining rent for created accounts"
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard system program, for creating accounts"
          ]
        }
      ],
      "args": [
        {
          "name": "poolManagerBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "newGame",
      "docs": [
        "Creates/starts a new game and enters the payer/player into it"
      ],
      "accounts": [
        {
          "name": "game",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "firstPlayer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programFeeDestination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "depositSourceAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "config",
          "type": {
            "defined": "GameConfig"
          }
        },
        {
          "name": "gameId",
          "type": "u64"
        },
        {
          "name": "poolManager",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "enterGame",
      "docs": [
        "Enters the player into an existing game"
      ],
      "accounts": [
        {
          "name": "game",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "game account of the game being played"
          ]
        },
        {
          "name": "player",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player state account of the new player"
          ]
        },
        {
          "name": "programFeeDestination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "depositSourceAccount",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player's token acount from which their entry deposit is taken"
          ]
        },
        {
          "name": "tokenPool",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "token pool of the mint/game"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "payer for creating player state, must be the player"
          ]
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard SPL token program, for transferring token deposit"
          ]
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard rent sysvar, for determining rent for created accounts"
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard system program, for creating accounts"
          ]
        }
      ],
      "args": [
        {
          "name": "bucket",
          "type": "u8"
        },
        {
          "name": "poolManager",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "moveBuckets",
      "docs": [
        "Moves the player from one bucket into another. Trying to move into the same",
        "bucket the player is already in will result in a failure."
      ],
      "accounts": [
        {
          "name": "game",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "game account of the game being played"
          ]
        },
        {
          "name": "player",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player state account of the moving player"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "payer for paying moving transaction fee"
          ]
        }
      ],
      "args": [
        {
          "name": "bucket",
          "type": "u8"
        }
      ]
    },
    {
      "name": "leaveGame",
      "docs": [
        "Leaves the game, transferring any winnings into the player's token account",
        "The last player to leave gets all the unclaimed tokens in the game."
      ],
      "accounts": [
        {
          "name": "game",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "game account of the game being played"
          ]
        },
        {
          "name": "gameMint",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "mint of this game"
          ]
        },
        {
          "name": "gameCreator",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "player",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player state account of the leaving player; rent will be returned",
            "to the payer (who must be the player)"
          ]
        },
        {
          "name": "winningsDestinationAccount",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player's token acount to which their winnings are transferred;",
            "owner/authority must be the payer"
          ]
        },
        {
          "name": "poolManager",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "token pool manager that signs the transaction to transfer",
            "winnings to the player"
          ]
        },
        {
          "name": "tokenPool",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "token pool of the mint/game"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "transaction fee payer; receives rent of closed player account"
          ]
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard SPL token program, for transferring winnings"
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard system program, for closing accounts"
          ]
        }
      ],
      "args": [
        {
          "name": "cancelOnLoss",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "game",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": {
              "defined": "GameConfig"
            }
          },
          {
            "name": "state",
            "type": {
              "defined": "GameState"
            }
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "playerState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bucket",
            "type": "u8"
          },
          {
            "name": "burnPenaltyDecimalTokens",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "poolManager",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "GameConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "entryFeeDecimalTokens",
            "type": "u64"
          },
          {
            "name": "spillRateDecimalTokensPerSecondPerPlayer",
            "type": "u64"
          },
          {
            "name": "nBuckets",
            "type": "u8"
          },
          {
            "name": "maxPlayers",
            "type": "u16"
          },
          {
            "name": "burnRateDecimalTokensPerMove",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "GameState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buckets",
            "type": {
              "vec": {
                "defined": "Bucket"
              }
            }
          },
          {
            "name": "lastUpdateEpochSeconds",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "Bucket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "decimalTokens",
            "type": "u64"
          },
          {
            "name": "players",
            "docs": [
              "Number of players currently occupying this bucket. For the holding bucket",
              "this will be the total number of players in the game."
            ],
            "type": "u16"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidEntryFee",
      "msg": "Entry fee must be positive"
    },
    {
      "code": 6001,
      "name": "TooFewBuckets",
      "msg": "Number of buckets must be positive"
    },
    {
      "code": 6002,
      "name": "TooManyBuckets",
      "msg": "Game cannot have more than 64 buckets"
    },
    {
      "code": 6003,
      "name": "GameAtCapacity",
      "msg": "Game is at capacity"
    },
    {
      "code": 6004,
      "name": "InvalidSpillRate",
      "msg": "Token spill rate must be positive"
    },
    {
      "code": 6005,
      "name": "MaxPlayersTooSmall",
      "msg": "Game must allow more than 1 player"
    },
    {
      "code": 6006,
      "name": "MaxPlayersTooLarge",
      "msg": "Game cannot have more than 10,000 players"
    },
    {
      "code": 6007,
      "name": "BucketDoesNotExist",
      "msg": "Attempted to enter a bucket that doesnt exist"
    },
    {
      "code": 6008,
      "name": "CannotEnterHoldingBucket",
      "msg": "Not allowed to enter the holding bucket (index 0)"
    },
    {
      "code": 6009,
      "name": "AlreadyInBucket",
      "msg": "Attempted to move within the same bucket"
    },
    {
      "code": 6010,
      "name": "GameIsOver",
      "msg": "Attempted to enter a game that has already ended"
    },
    {
      "code": 6011,
      "name": "InvalidProgramFeeDestination",
      "msg": "Program fee pubkey must be the one hard-coded in the program"
    },
    {
      "code": 6012,
      "name": "InvalidPoolMint",
      "msg": "Pool mint must be the one configured for the game"
    },
    {
      "code": 6013,
      "name": "InvalidPoolManager",
      "msg": "Pool manager must be the provided pool manager"
    },
    {
      "code": 6014,
      "name": "InvalidTokenPool",
      "msg": "Token pool address is incorrect"
    },
    {
      "code": 6015,
      "name": "InvalidTokenPoolOwner",
      "msg": "Token pool owner must be the pool manager"
    },
    {
      "code": 6016,
      "name": "InvalidPoolManagerOwner",
      "msg": "Pool manager owner must be this program"
    },
    {
      "code": 6017,
      "name": "InvalidWinningsDestinationMint",
      "msg": "Token winnings acount mint must be the one configured for the game"
    },
    {
      "code": 6018,
      "name": "InvalidTokenSourceMint",
      "msg": "Token source acount mint must be the one configured for the game"
    },
    {
      "code": 6019,
      "name": "InvalidBurnMint",
      "msg": "Mint being burned must be the one configured for the game"
    },
    {
      "code": 6020,
      "name": "InvalidProgramId",
      "msg": "Program ID must be this program"
    },
    {
      "code": 6021,
      "name": "GameCreatorMismatch",
      "msg": "Given gameCreator doesnt match the one that created the game"
    },
    {
      "code": 6022,
      "name": "AbortLeaveOnLoss",
      "msg": "Player chose to abort leaving rather than lose tokens"
    }
  ]
};

export const IDL: Equilibrate = {
  "version": "0.1.0",
  "name": "equilibrate",
  "instructions": [
    {
      "name": "createPool",
      "docs": [
        "Creates the token pool and pool manager used to sign token payouts from the pool.",
        "Should only be called once per game mint."
      ],
      "accounts": [
        {
          "name": "poolManager",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "account that signs for token payouts from the token pool"
          ]
        },
        {
          "name": "tokenPool",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "token pool for all games played with `game_mint`"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "payer to create the token pool and pool manager accounts"
          ]
        },
        {
          "name": "gameMint",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "mint of the token pool for all games of this mint"
          ]
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard SPL token program, for creating the token pool"
          ]
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard rent sysvar, for determining rent for created accounts"
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard system program, for creating accounts"
          ]
        }
      ],
      "args": [
        {
          "name": "poolManagerBump",
          "type": "u8"
        }
      ]
    },
    {
      "name": "newGame",
      "docs": [
        "Creates/starts a new game and enters the payer/player into it"
      ],
      "accounts": [
        {
          "name": "game",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "firstPlayer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "programFeeDestination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "depositSourceAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenPool",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "config",
          "type": {
            "defined": "GameConfig"
          }
        },
        {
          "name": "gameId",
          "type": "u64"
        },
        {
          "name": "poolManager",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "enterGame",
      "docs": [
        "Enters the player into an existing game"
      ],
      "accounts": [
        {
          "name": "game",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "game account of the game being played"
          ]
        },
        {
          "name": "player",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player state account of the new player"
          ]
        },
        {
          "name": "programFeeDestination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "depositSourceAccount",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player's token acount from which their entry deposit is taken"
          ]
        },
        {
          "name": "tokenPool",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "token pool of the mint/game"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "payer for creating player state, must be the player"
          ]
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard SPL token program, for transferring token deposit"
          ]
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard rent sysvar, for determining rent for created accounts"
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard system program, for creating accounts"
          ]
        }
      ],
      "args": [
        {
          "name": "bucket",
          "type": "u8"
        },
        {
          "name": "poolManager",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "moveBuckets",
      "docs": [
        "Moves the player from one bucket into another. Trying to move into the same",
        "bucket the player is already in will result in a failure."
      ],
      "accounts": [
        {
          "name": "game",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "game account of the game being played"
          ]
        },
        {
          "name": "player",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player state account of the moving player"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "payer for paying moving transaction fee"
          ]
        }
      ],
      "args": [
        {
          "name": "bucket",
          "type": "u8"
        }
      ]
    },
    {
      "name": "leaveGame",
      "docs": [
        "Leaves the game, transferring any winnings into the player's token account",
        "The last player to leave gets all the unclaimed tokens in the game."
      ],
      "accounts": [
        {
          "name": "game",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "game account of the game being played"
          ]
        },
        {
          "name": "gameMint",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "mint of this game"
          ]
        },
        {
          "name": "gameCreator",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "player",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player state account of the leaving player; rent will be returned",
            "to the payer (who must be the player)"
          ]
        },
        {
          "name": "winningsDestinationAccount",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "player's token acount to which their winnings are transferred;",
            "owner/authority must be the payer"
          ]
        },
        {
          "name": "poolManager",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "token pool manager that signs the transaction to transfer",
            "winnings to the player"
          ]
        },
        {
          "name": "tokenPool",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "token pool of the mint/game"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "transaction fee payer; receives rent of closed player account"
          ]
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard SPL token program, for transferring winnings"
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "standard system program, for closing accounts"
          ]
        }
      ],
      "args": [
        {
          "name": "cancelOnLoss",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "game",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": {
              "defined": "GameConfig"
            }
          },
          {
            "name": "state",
            "type": {
              "defined": "GameState"
            }
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "playerState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bucket",
            "type": "u8"
          },
          {
            "name": "burnPenaltyDecimalTokens",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "poolManager",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "GameConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "publicKey"
          },
          {
            "name": "entryFeeDecimalTokens",
            "type": "u64"
          },
          {
            "name": "spillRateDecimalTokensPerSecondPerPlayer",
            "type": "u64"
          },
          {
            "name": "nBuckets",
            "type": "u8"
          },
          {
            "name": "maxPlayers",
            "type": "u16"
          },
          {
            "name": "burnRateDecimalTokensPerMove",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "GameState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buckets",
            "type": {
              "vec": {
                "defined": "Bucket"
              }
            }
          },
          {
            "name": "lastUpdateEpochSeconds",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "Bucket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "decimalTokens",
            "type": "u64"
          },
          {
            "name": "players",
            "docs": [
              "Number of players currently occupying this bucket. For the holding bucket",
              "this will be the total number of players in the game."
            ],
            "type": "u16"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidEntryFee",
      "msg": "Entry fee must be positive"
    },
    {
      "code": 6001,
      "name": "TooFewBuckets",
      "msg": "Number of buckets must be positive"
    },
    {
      "code": 6002,
      "name": "TooManyBuckets",
      "msg": "Game cannot have more than 64 buckets"
    },
    {
      "code": 6003,
      "name": "GameAtCapacity",
      "msg": "Game is at capacity"
    },
    {
      "code": 6004,
      "name": "InvalidSpillRate",
      "msg": "Token spill rate must be positive"
    },
    {
      "code": 6005,
      "name": "MaxPlayersTooSmall",
      "msg": "Game must allow more than 1 player"
    },
    {
      "code": 6006,
      "name": "MaxPlayersTooLarge",
      "msg": "Game cannot have more than 10,000 players"
    },
    {
      "code": 6007,
      "name": "BucketDoesNotExist",
      "msg": "Attempted to enter a bucket that doesnt exist"
    },
    {
      "code": 6008,
      "name": "CannotEnterHoldingBucket",
      "msg": "Not allowed to enter the holding bucket (index 0)"
    },
    {
      "code": 6009,
      "name": "AlreadyInBucket",
      "msg": "Attempted to move within the same bucket"
    },
    {
      "code": 6010,
      "name": "GameIsOver",
      "msg": "Attempted to enter a game that has already ended"
    },
    {
      "code": 6011,
      "name": "InvalidProgramFeeDestination",
      "msg": "Program fee pubkey must be the one hard-coded in the program"
    },
    {
      "code": 6012,
      "name": "InvalidPoolMint",
      "msg": "Pool mint must be the one configured for the game"
    },
    {
      "code": 6013,
      "name": "InvalidPoolManager",
      "msg": "Pool manager must be the provided pool manager"
    },
    {
      "code": 6014,
      "name": "InvalidTokenPool",
      "msg": "Token pool address is incorrect"
    },
    {
      "code": 6015,
      "name": "InvalidTokenPoolOwner",
      "msg": "Token pool owner must be the pool manager"
    },
    {
      "code": 6016,
      "name": "InvalidPoolManagerOwner",
      "msg": "Pool manager owner must be this program"
    },
    {
      "code": 6017,
      "name": "InvalidWinningsDestinationMint",
      "msg": "Token winnings acount mint must be the one configured for the game"
    },
    {
      "code": 6018,
      "name": "InvalidTokenSourceMint",
      "msg": "Token source acount mint must be the one configured for the game"
    },
    {
      "code": 6019,
      "name": "InvalidBurnMint",
      "msg": "Mint being burned must be the one configured for the game"
    },
    {
      "code": 6020,
      "name": "InvalidProgramId",
      "msg": "Program ID must be this program"
    },
    {
      "code": 6021,
      "name": "GameCreatorMismatch",
      "msg": "Given gameCreator doesnt match the one that created the game"
    },
    {
      "code": 6022,
      "name": "AbortLeaveOnLoss",
      "msg": "Player chose to abort leaving rather than lose tokens"
    }
  ]
};

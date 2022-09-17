import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import {
  generateBucketIndex as chooseBucket,
  generateGameId,
  getGame,
  getPlayerState,
  PROGRAM_FEE_DESTINATION,
  PROGRAM_FEE_LAMPORTS,
} from "./helpers/game";
import {
  generateMint,
  getSolBalance,
  getTokenBalanceWithDecimals,
  getTokenBalanceWithoutDecimals,
  makeAndFundWallet,
  makeAndFundWalletWithTokens,
  makeAssociatedTokenAccount,
  makeAssociatedTokenAccountWithPayer,
  MINT_DECIMALS,
  withoutDecimals,
} from "./helpers/token";
import { Game, GameState, PlayerState } from "./helpers/types";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import {
  GAME_SEED,
  getGameAddress,
  getPlayerStateAddress,
  PLAYER_SEED,
} from "./helpers/address";
import { assert } from "chai";
import { assertAsyncThrows, repeat } from "./helpers/test";
import { NewGameContext, NewGameSetupArgs, setUpNewGame } from "./newGame";
import { testIsReady } from "./setup";

describe("EnterGame Instruction Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

  it("enter game > all good > player is deposited into correct bucket", async () => {
    const nOtherPlayers: number = Math.ceil(Math.random() * 10) + 1;
    const { newGame: newGameContext } = await setUpNewGameAndEnter(program, {
      otherPlayers: nOtherPlayers - 1,
    });

    const gameBeforePlayerEnters: Game = await getGame(
      newGameContext.gameAddress,
      program
    );

    const { playerStateAddress, playerBucketIndex } = await setUpEnterGame(
      program,
      newGameContext
    );

    const playerState: PlayerState = await getPlayerState(
      playerStateAddress,
      program
    );
    const game: Game = await getGame(newGameContext.gameAddress, program);

    assert.strictEqual(playerState.bucket.toNumber(), playerBucketIndex);
    assert.strictEqual(
      game.state.buckets[playerBucketIndex].players,
      gameBeforePlayerEnters.state.buckets[playerBucketIndex].players + 1
    );

    const totalPlayerAcrossBuckets: number = game.state.buckets
      .slice(1)
      .reduce((partialSum, b) => partialSum + b.players, 0);
    assert.strictEqual(game.state.buckets[0].players, nOtherPlayers + 1);
    assert.strictEqual(totalPlayerAcrossBuckets, nOtherPlayers + 1);
  });

  it("enter game > all good > program fee is transferred", async () => {
    const connection: Connection = program.provider.connection;
    // appears that wallet balances (all ledger transactions?) carry over
    // across tests, so we need to check the change in balance rather than the
    // whole balance, since other tests may put program fee in the wallet
    const programFeeDestinatonBalancePreGame: number = await getSolBalance(
      PROGRAM_FEE_DESTINATION,
      connection
    );
    const nOtherPlayers: number = Math.round(Math.random() * 10) + 1;

    await setUpNewGameAndEnter(program, {
      otherPlayers: nOtherPlayers,
    });

    const programFeeDestinationBalance: number = await getSolBalance(
      PROGRAM_FEE_DESTINATION,
      connection
    );
    const programFeeSol: number =
      PROGRAM_FEE_LAMPORTS / anchor.web3.LAMPORTS_PER_SOL;
    assert.approximately(
      // double the fee to account for first and second player
      (nOtherPlayers + 1) * programFeeSol,
      programFeeDestinationBalance - programFeeDestinatonBalancePreGame,
      1 / anchor.web3.LAMPORTS_PER_SOL
    );
    // It would be great to also check that the player's balance went
    // down by the program fee, but without knowing solana's transaction
    // fee we cant calculate what the new balance should be. That's OK,
    // though, since the only source of income to the fee destination is
    // the player's account
  });

  it("enter game > all good > game tokens are transfered", async () => {
    const connection: Connection = program.provider.connection;
    const nOtherPlayers: number = Math.round(Math.random() * 10) + 1;
    const {
      playerWallet,
      newGame: { mint, gameConfig },
      playerStartingTokens,
    } = await setUpNewGameAndEnter(program, {
      otherPlayers: nOtherPlayers,
    });

    const playerTokenBalance: number = await getTokenBalanceWithoutDecimals(
      playerWallet.publicKey,
      mint.publicKey,
      connection
    );
    const tokenPoolBalance: number = await getTokenBalanceWithoutDecimals(
      program.programId,
      mint.publicKey,
      connection
    );
    const entryFeeWithoutDecimals: number = withoutDecimals(
      gameConfig.entryFeeDecimalTokens.toNumber(),
      MINT_DECIMALS
    );
    assert.approximately(
      (nOtherPlayers + 1) * entryFeeWithoutDecimals,
      tokenPoolBalance,
      Math.pow(10, -MINT_DECIMALS)
    );
    assert.approximately(
      entryFeeWithoutDecimals,
      playerStartingTokens - playerTokenBalance,
      Math.pow(10, -MINT_DECIMALS)
    );
  });

  it("enter game > all good > bucket balances update correctly", async () => {
    const entryFee: number = 1 * Math.pow(10, MINT_DECIMALS);
    const spillRate: number = 1 * Math.pow(10, MINT_DECIMALS);
    const { newGame: newGameContext } = await setUpNewGameAndEnter(program, {
      otherPlayers: 1,
      playerBucketIndex: 2,
      newGame: {
        gameConfig: {
          nBuckets: new anchor.BN(2),
          entryFeeDecimalTokens: new anchor.BN(entryFee),
          spillRateDecimalTokensPerSecondPerPlayer: new anchor.BN(spillRate),
        },
      },
    });

    const gameState: GameState = (
      await getGame(newGameContext.gameAddress, program)
    ).state;

    // after the first player enters, the holding bucket gets their fee.
    // after the second player enters, the holding bucket distributes the holding
    // fee equally to the other two buckets, and we add the new player's fee
    // to the holding bucket
    assert.strictEqual(gameState.buckets[0].decimalTokens.toNumber(), entryFee);
    assert.strictEqual(
      gameState.buckets[1].decimalTokens.toNumber(),
      entryFee / 2
    );
    assert.strictEqual(
      gameState.buckets[2].decimalTokens.toNumber(),
      entryFee / 2
    );
  });

  it(
    "enter game > all good > prize pool balance remains consistent",
    repeat(10, async () => {
      const nOtherPlayers: number = Math.ceil(Math.random() * 10) + 1;
      const { newGame: newGameContext } = await setUpNewGameAndEnter(program, {
        otherPlayers: nOtherPlayers - 1,
      });

      await setUpEnterGame(program, newGameContext, undefined, true);

      const gameStateAfterWeEnter: GameState = (
        await getGame(newGameContext.gameAddress, program)
      ).state;

      const bucketTokenTotal: number = gameStateAfterWeEnter.buckets.reduce(
        (partialSum, b) => partialSum + b.decimalTokens.toNumber(),
        0
      );
      const tokenPoolBalance: number = await getTokenBalanceWithDecimals(
        program.programId,
        newGameContext.gameConfig.mint,
        program.provider.connection
      );
      const expectedTokenTotal: number =
        (nOtherPlayers + 1) *
        newGameContext.gameConfig.entryFeeDecimalTokens.toNumber();
      assert.strictEqual(bucketTokenTotal, expectedTokenTotal);
      assert.strictEqual(tokenPoolBalance, expectedTokenTotal);
    })
  );

  it("enter game > game is at capacity > fails", async () => {
    const maxPlayers: number = Math.ceil(Math.random() * 5) + 1;
    await assertAsyncThrows(
      () =>
        setUpNewGameAndEnter(program, {
          otherPlayers: maxPlayers,
          newGame: {
            gameConfig: {
              maxPlayers: new anchor.BN(maxPlayers),
            },
          },
        }),
      "GameAtCapacity"
    );
  });

  it("enter game > game - bad seed - seed > fails", async () => {
    const gameId: number = generateGameId();
    const goodGameAddress: PublicKey = await getGameAddress(
      gameId,
      program.programId
    );
    const badGameAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("a bad seed my dude"),
          new anchor.BN(gameId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )
    )[0];

    const newGameContext: NewGameContext = await setUpNewGame(program, {
      gameId: gameId,
      gameAddress: goodGameAddress,
    });

    await assertAsyncThrows(
      () =>
        setUpEnterGame(program, {
          ...newGameContext,
          gameAddress: badGameAddress,
        }),
      // there's not really a situation where we can try to enter a game
      // that already exists but then provide a bad seeded game address, so
      // checking that the account isnt initialized is as close as we can get
      "AccountNotInitialized"
    );
  });

  it("enter game > game - bad seed - game ID > fails", async () => {
    const gameId: number = generateGameId();
    const goodGameAddress: PublicKey = await getGameAddress(
      gameId,
      program.programId
    );
    const badGameAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(GAME_SEED),
          new anchor.BN(generateGameId()).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )
    )[0];

    const newGameContext: NewGameContext = await setUpNewGame(program, {
      gameId: gameId,
      gameAddress: goodGameAddress,
    });

    await assertAsyncThrows(
      () =>
        setUpEnterGame(program, {
          ...newGameContext,
          gameAddress: badGameAddress,
        }),
      // there's not really a situation where we can try to enter a game
      // that already exists but then provide a bad seeded game address, so
      // checking that the account isnt initialized is as close as we can get
      "AccountNotInitialized"
    );
  });

  it("enter game > player - bad seed - seed > fails", async () => {
    const playerWallet: Keypair = Keypair.generate();
    const gameId: number = generateGameId();
    const gameAddress: PublicKey = await getGameAddress(
      gameId,
      program.programId
    );
    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("this player sucks"),
          gameAddress.toBuffer(),
          playerWallet.publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];
    const goodPlayerStateAddress: PublicKey = await getPlayerStateAddress(
      gameAddress,
      playerWallet.publicKey,
      program.programId
    );

    const newGameContext: NewGameContext = await setUpNewGame(program, {
      gameId: gameId,
      gameAddress: gameAddress,
      playerWallet: playerWallet,
      playerStateAddress: goodPlayerStateAddress,
    });

    await assertAsyncThrows(
      () =>
        setUpEnterGame(program, newGameContext, {
          playerStateAddress: badPlayerStateAddress,
        }),
      // there's not really a situation where we can try to enter a game
      // that already exists but then provide a bad seeded address, so
      // checking that the account isnt initialized is as close as we can get
      "AccountNotInitialized"
    );
  });

  it("enter game > player - bad seed - game > fails", async () => {
    const playerWallet: Keypair = Keypair.generate();
    const gameId: number = generateGameId();
    const gameAddress: PublicKey = await getGameAddress(
      gameId,
      program.programId
    );
    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(PLAYER_SEED),
          Keypair.generate().publicKey.toBuffer(),
          playerWallet.publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];
    const goodPlayerStateAddress: PublicKey = await getPlayerStateAddress(
      gameAddress,
      playerWallet.publicKey,
      program.programId
    );

    const newGameContext: NewGameContext = await setUpNewGame(program, {
      gameId: gameId,
      gameAddress: gameAddress,
      playerWallet: playerWallet,
      playerStateAddress: goodPlayerStateAddress,
    });

    await assertAsyncThrows(
      () =>
        setUpEnterGame(program, newGameContext, {
          playerStateAddress: badPlayerStateAddress,
        }),
      // there's not really a situation where we can try to enter a game
      // that already exists but then provide a bad seeded address, so
      // checking that the account isnt initialized is as close as we can get
      "AccountNotInitialized"
    );
  });

  it("enter game > player - bad seed - payer > fails", async () => {
    const playerWallet: Keypair = Keypair.generate();
    const gameId: number = generateGameId();
    const gameAddress: PublicKey = await getGameAddress(
      gameId,
      program.programId
    );
    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(PLAYER_SEED),
          gameAddress.toBuffer(),
          Keypair.generate().publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];
    const goodPlayerStateAddress: PublicKey = await getPlayerStateAddress(
      gameAddress,
      playerWallet.publicKey,
      program.programId
    );

    const newGameContext: NewGameContext = await setUpNewGame(program, {
      gameId: gameId,
      gameAddress: gameAddress,
      playerWallet: playerWallet,
      playerStateAddress: goodPlayerStateAddress,
    });

    await assertAsyncThrows(
      () =>
        setUpEnterGame(program, newGameContext, {
          playerStateAddress: badPlayerStateAddress,
        }),
      // there's not really a situation where we can try to enter a game
      // that already exists but then provide a bad seeded address, so
      // checking that the account isnt initialized is as close as we can get
      "AccountNotInitialized"
    );
  });

  it("enter game > player - wrong account owner > fails", async () => {
    const newGameContext: NewGameContext = await setUpNewGame(program);
    const playerWallet: Keypair = await makeAndFundWallet(
      1,
      program.provider.connection
    );
    const badPlayerStateAddress: PublicKey = await getPlayerStateAddress(
      newGameContext.gameAddress,
      playerWallet.publicKey,
      anchor.web3.SystemProgram.programId
    );

    await assertAsyncThrows(() =>
      setUpEnterGame(program, newGameContext, {
        playerWallet: playerWallet,
        playerStateAddress: badPlayerStateAddress,
      })
    );
  });

  it("enter game > program fee destination is wrong > fails", async () => {
    await assertAsyncThrows(
      () =>
        setUpNewGameAndEnter(program, {
          programFeeDestination: Keypair.generate().publicKey,
        }),
      "InvalidProgramFeeDestination"
    );
  });

  it("enter game > deposit source account - mint doesnt match game > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(10, connection);
    const wrongMint: Keypair = await generateMint(authority, connection);
    const { wallet, tokenAccount } = await makeAndFundWalletWithTokens(
      1,
      1000,
      wrongMint.publicKey,
      authority,
      connection
    );

    await assertAsyncThrows(
      () =>
        setUpNewGameAndEnter(program, {
          playerWallet: wallet,
          playerTokenAccount: tokenAccount,
        }),
      "InvalidTokenSourceMint"
    );
  });

  it("enter game > token pool - wrong mint > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(10, connection);
    const wrongMint: Keypair = await generateMint(authority, connection);
    const wallet: Keypair = await makeAndFundWallet(1, connection);

    const wrongTokenPool: PublicKey = await makeAssociatedTokenAccountWithPayer(
      wallet,
      program.programId,
      wrongMint.publicKey,
      connection
    );

    await assertAsyncThrows(
      () =>
        setUpNewGameAndEnter(program, {
          tokenPoolAddress: wrongTokenPool,
        }),
      "InvalidPoolMint"
    );
  });

  it("enter game > token pool - owner isnt program > fails", async () => {
    const newGameContext: NewGameContext = await setUpNewGame(program);
    const connection: Connection = program.provider.connection;
    const wallet: Keypair = await makeAndFundWallet(1, connection);

    const wrongTokenPool: PublicKey = await makeAssociatedTokenAccount(
      wallet,
      newGameContext.mint.publicKey,
      connection
    );

    await assertAsyncThrows(
      () =>
        setUpEnterGame(program, newGameContext, {
          tokenPoolAddress: wrongTokenPool,
        }),
      "InvalidPoolOwner"
    );
  });

  it("enter game > bucket index too high > fails", async () => {
    const newGameContext: NewGameContext = await setUpNewGame(program);
    await assertAsyncThrows(
      () =>
        setUpEnterGame(program, newGameContext, {
          playerBucketIndex: newGameContext.gameConfig.nBuckets.toNumber() + 1,
        }),
      "BucketDoesNotExist"
    );
  });

  it("enter game > player tries to enter holding bucket > fails", async () => {
    await assertAsyncThrows(
      () =>
        setUpNewGameAndEnter(program, {
          playerBucketIndex: 0,
        }),
      "CannotEnterHoldingBucket"
    );
  });

  it("enter game > game hasnt been created > fails", async () => {
    const newGameContext: NewGameContext = await setUpNewGame(program);
    const nonGame: PublicKey = await getGameAddress(generateGameId(), program.programId);
    await assertAsyncThrows(
      () =>
        setUpEnterGame(program, newGameContext, {
          gameAddress: nonGame
        })
    );
  });
});

export interface NewGameAndEnterSetupArgs extends EnterGameSetupArgs {
  newGame?: NewGameSetupArgs;
}

export interface EnterGameSetupArgs {
  otherPlayers?: number;
  playerBucketIndex?: number;
  playerStartingSol?: number;
  playerStartingTokens?: number;
  playerWallet?: Keypair;
  playerTokenAccount?: PublicKey;
  playerStateAddress?: PublicKey;
  programFeeDestination?: PublicKey;
  tokenPoolAddress?: PublicKey;
  gameAddress?: PublicKey;
}

export interface EnterGameContext {
  playerStartingSol: number;
  playerStartingTokens: number;
  playerWallet: Keypair;
  playerTokenAccount: PublicKey;
  playerStateAddress: PublicKey;
  playerBucketIndex: number;
}

export interface NewGameAndEnterContext extends EnterGameContext {
  newGame: NewGameContext;
}

export async function setUpNewGameAndEnter(
  program: anchor.Program<Equilibrate>,
  customSetup?: NewGameAndEnterSetupArgs
): Promise<NewGameAndEnterContext> {
  if (
    customSetup?.otherPlayers != null &&
    customSetup?.newGame?.gameConfig?.maxPlayers == null
  ) {
    customSetup = customSetup ?? {};
    customSetup.newGame = customSetup.newGame ?? {};
    customSetup.newGame.gameConfig = customSetup.newGame.gameConfig ?? {};
    customSetup.newGame.gameConfig.maxPlayers = new anchor.BN(
      customSetup.otherPlayers * 10
    );
  }

  const newGameContext: NewGameContext = await setUpNewGame(
    program,
    customSetup?.newGame
  );

  const enterGameContext: EnterGameContext = await setUpEnterGame(
    program,
    newGameContext,
    customSetup
  );

  return {
    ...enterGameContext,
    newGame: newGameContext,
  };
}

async function setUpEnterGame(
  program: anchor.Program<Equilibrate>,
  newGameContext: NewGameContext,
  customSetup?: EnterGameSetupArgs,
  debug: boolean = false
): Promise<EnterGameContext> {
  if (!testIsReady()) throw new Error("not ready");
  const connection: Connection = program.provider.connection;

  const nonFirstPlayersToEnter: number =
    customSetup?.otherPlayers == null ? 1 : customSetup.otherPlayers;
  if (nonFirstPlayersToEnter < 1) {
    throw new Error(
      "otherPlayers must be > 0. It includes the first player that made the game"
    );
  }

  let playerTokens: number;
  let playerStartingSol: number;
  let player: Keypair;
  let playerTokenAccount: PublicKey;
  let playerStateAddress: PublicKey;
  let bucketIndex: number;
  // the last player entered will be the one used in the test
  for (let i = 0; i < nonFirstPlayersToEnter; i++) {
    playerTokens =
      customSetup?.playerStartingTokens != null
        ? customSetup?.playerStartingTokens
        : Math.ceil(
            1.1 *
              withoutDecimals(
                newGameContext.gameConfig.entryFeeDecimalTokens.toNumber(),
                MINT_DECIMALS
              )
          );

    playerStartingSol =
      customSetup?.playerStartingSol != null
        ? customSetup?.playerStartingSol
        : (10 * PROGRAM_FEE_LAMPORTS) / anchor.web3.LAMPORTS_PER_SOL;

    const fundResult = await makeAndFundWalletWithTokens(
      playerStartingSol,
      playerTokens,
      newGameContext.mint.publicKey,
      newGameContext.mintAuthority,
      connection
    );
    player = fundResult.wallet;
    playerTokenAccount = fundResult.tokenAccount;

    if (customSetup?.playerWallet != null) player = customSetup?.playerWallet;

    if (customSetup?.playerTokenAccount != null) {
      playerTokenAccount = customSetup?.playerTokenAccount;
    }

    playerStateAddress =
      customSetup?.playerStateAddress ??
      (await getPlayerStateAddress(
        newGameContext.gameAddress,
        player.publicKey,
        program.programId
      ));

    bucketIndex =
      customSetup?.playerBucketIndex == null
        ? chooseBucket(newGameContext.gameConfig.nBuckets.toNumber())
        : customSetup?.playerBucketIndex;

    try {
      await program.methods
        .enterGame(new anchor.BN(bucketIndex))
        .accountsStrict({
          game: customSetup?.gameAddress ?? newGameContext.gameAddress,
          player: playerStateAddress,
          programFeeDestination:
            customSetup?.programFeeDestination ?? PROGRAM_FEE_DESTINATION,
          depositSourceAccount: playerTokenAccount,
          tokenPool:
            customSetup?.tokenPoolAddress ?? newGameContext.tokenPoolAddress,
          payer: player.publicKey,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([player])
        .rpc();
    } catch (e) {
      if (debug) {
        console.log(JSON.stringify(e));
      }
      throw e;
    }
  }

  return {
    playerStartingSol,
    playerStartingTokens: playerTokens,
    playerWallet: player,
    playerTokenAccount,
    playerStateAddress,
    playerBucketIndex: bucketIndex,
  };
}

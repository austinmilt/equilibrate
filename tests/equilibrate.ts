import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { assert } from "chai";
import { Equilibrate } from "../target/types/equilibrate";

describe("dummy", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Equilibrate as Program<Equilibrate>;

  it("compute that tokens are not lost due to the way that spillover is calculated", async () => {
    assert(false);
  });

  it("simulate a game 100 times", async () => {
    assert(false);
  });
});

//TODO 

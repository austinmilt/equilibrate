import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";

describe("equilibrate", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Equilibrate as Program<Equilibrate>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});

//TODO compute that tokens are not lost due to the way that spillover is calculated

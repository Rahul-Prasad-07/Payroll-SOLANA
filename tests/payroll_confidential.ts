import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { PayrollConfidential } from "../target/types/payroll_confidential";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, AuthorityType, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, transfer } from "@solana/spl-token";
import { assert } from "chai";
describe("payroll_confidential", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const program = anchor.workspace.PayrollConfidential as Program<PayrollConfidential>;
  const authority = Keypair.fromSecretKey(new Uint8Array(require("../swap.json")));

  const tokenMintA = new PublicKey("J1q7FEiMhzgd1T9bGtdh8ZTZa8mhsyszaW4AqQPvYxWX");

  const userA = Keypair.fromSecretKey(new Uint8Array(require("../swap.json")));
  const userB = Keypair.fromSecretKey(new Uint8Array(require("../chaidex.json")));



  let payrollId = "company_payroll_1";
  let paymentToken = tokenMintA;
  let payroll;
  let payrollVault;
  let employee1 = userA
  let employee1Wallet;
  let employee2 = userB
  let employee2Wallet;
  let authorityWallet;

  before(async () => {
    // Create a token mint for testin

    // Create token accounts
    authorityWallet = getAssociatedTokenAddressSync(
      paymentToken,
      authority.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    employee1Wallet = getAssociatedTokenAddressSync(
      paymentToken,
      employee1.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    employee2Wallet = getAssociatedTokenAddressSync(
      paymentToken,
      employee2.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  });

  it.skip("Initializes payroll", async () => {

    const [payrollPda, _payrollBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("payroll"), Buffer.from(payrollId)],
      program.programId
    );
    payroll = payrollPda;

    const [vaultPda, _vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), payrollPda.toBuffer()],
      program.programId
    );
    payrollVault = vaultPda;


    const txSPL = await program.methods
      .initializePayroll(payrollId, paymentToken)
      .accounts({
        payroll: payroll,
        payrollVault: payrollVault,
        paymentToken: paymentToken,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      }).signers([authority])
      .rpc();

    console.log("SPL deposit txn signature:", txSPL);

    const payrollAccount = await program.account.payroll.fetch(payroll);
    assert.equal(payrollAccount.authority.toString(), authority.publicKey.toString());
    assert.equal(payrollAccount.payrollId, payrollId);
    assert.equal(payrollAccount.paymentToken.toString(), paymentToken.toString());
    assert.equal(payrollAccount.employeeCount.toNumber(), 0);
    assert.equal(payrollAccount.isActive, true);

  });


  it.skip("Adds employee 1", async () => {

    const chaiTToken = new BN(1100000000000) // 1100 tokens ~ 9 decimals

    const payRollPda = PublicKey.findProgramAddressSync(
      [Buffer.from("payroll"), Buffer.from(payrollId)],
      program.programId
    )[0];
    const employeePda = PublicKey.findProgramAddressSync(
      [Buffer.from("employee"), payRollPda.toBuffer(), Buffer.from("emp1")],
      program.programId
    )[0];

    const txSPL = await program.methods
      .addEmployee("emp1", chaiTToken, { weekly: {} })
      .accounts({
        payroll: payRollPda,
        employee: employeePda,
        employeeWallet: employee1Wallet,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();

    console.log("SPL deposit txn signature:", txSPL);
    const payrollAccount = await program.account.payroll.fetch(payRollPda);
    assert.equal(payrollAccount.employeeCount.toNumber(), 1);

    const employee1Account = await program.account.employee.fetch(employeePda);

    assert.equal(employee1Account.employeeId, "emp1");
    assert.equal(employee1Account.salaryAmount.toNumber(), chaiTToken.toNumber());
    // assert.equal(employee1Account.paymentFrequency.weekly, {});
  });

  it.skip("Adds employee 2", async () => {

    const chaiTToken = new BN(1500000000000) // 1100 tokens ~ 9 decimals

    const payRollPda = PublicKey.findProgramAddressSync(
      [Buffer.from("payroll"), Buffer.from(payrollId)],
      program.programId
    )[0];
    const employeePda = PublicKey.findProgramAddressSync(
      [Buffer.from("employee"), payRollPda.toBuffer(), Buffer.from("emp2")],
      program.programId
    )[0];

    const txSPL = await program.methods
      .addEmployee("emp2", chaiTToken, { weekly: {} })
      .accounts({
        payroll: payRollPda,
        employee: employeePda,
        employeeWallet: employee2Wallet,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();

    console.log("SPL deposit txn signature:", txSPL);
    const payrollAccount = await program.account.payroll.fetch(payRollPda);
    assert.equal(payrollAccount.employeeCount.toNumber(), 2);

    const employee2Account = await program.account.employee.fetch(employeePda);

    assert.equal(employee2Account.employeeId, "emp2");
    assert.equal(employee2Account.salaryAmount.toNumber(), chaiTToken.toNumber());
    // assert.equal(employee2Account.paymentFrequency.weekly, {});

    console.log("Employee 2 Account details:", JSON.stringify(employee2Account, null, 2));

  });

  it("fetches employee 2", async () => {

    console.log("calling getOrCreateAssociatedTokenAccount");
    // if employee1 wallet does not exist, create it
    const employee1TokenWalletAccount = await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      authority,
      paymentToken,
      employee1.publicKey
    )

    console.log("Employee 1 Token Wallet Account:", employee1TokenWalletAccount);

    // if employee2 wallet does not exist, create it
    const employee2TokenWalletAccount = await getOrCreateAssociatedTokenAccount(
      program.provider.connection,
      authority,
      paymentToken,
      employee2.publicKey
    )
    console.log("calling getOrCreateAssociatedTokenAccount");
    console.log("Employee 2 Token Wallet Account:", employee2TokenWalletAccount);



    const payRollPda = PublicKey.findProgramAddressSync(
      [Buffer.from("payroll"), Buffer.from(payrollId)],
      program.programId
    )[0];

    const employeePda = PublicKey.findProgramAddressSync(
      [Buffer.from("employee"), payRollPda.toBuffer(), Buffer.from("emp1")],
      program.programId
    )[0];

    const employee2Account = await program.account.employee.fetch(employeePda);

    console.log("Employee 2 Account details:", JSON.stringify(employee2Account, null, 2));

  });


  it.skip("Processes payroll", async () => {

    const payRollPda = PublicKey.findProgramAddressSync(
      [Buffer.from("payroll"), Buffer.from(payrollId)],
      program.programId
    )[0];

    const employeePda1 = PublicKey.findProgramAddressSync(
      [Buffer.from("employee"), payRollPda.toBuffer(), Buffer.from("emp1")],
      program.programId
    )[0];

    const employeePda2 = PublicKey.findProgramAddressSync(
      [Buffer.from("employee"), payRollPda.toBuffer(), Buffer.from("emp2")],
      program.programId
    )[0];


    const [vaultPda, _vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), payRollPda.toBuffer()],
      program.programId
    );
    payrollVault = vaultPda;


    const tx = await program.methods
      .processPayment("emp1")
      .accounts({
        payroll: payRollPda,
        employee: employeePda1,
        employeeWallet: employee1Wallet,
        authority: authority.publicKey,
        payrollVault: payrollVault,
        paymentToken: paymentToken,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc();


    console.log("SPL deposit txn signature:", tx);

    const employeeWalletBalance = await program.provider.connection.getTokenAccountBalance(employee1Wallet);
    console.log("Employee 1 Wallet Balance:", employeeWalletBalance.value.uiAmountString);

    const employee1Account = await program.account.employee.fetch(employeePda1);
    console.log("Employee 1 Account details:", JSON.stringify(employee1Account, null, 2));


    assert(employee1Account.lastPayment.gt(new BN(0)));
  });


});
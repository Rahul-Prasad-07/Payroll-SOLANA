import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, AuthorityType, createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, transfer } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { assert } from "chai";

import { PayrollStandard } from "../target/types/payroll_standard";

describe("payroll_confidential", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const program = anchor.workspace.PayrollStandard as Program<PayrollStandard>;
  const authority = Keypair.fromSecretKey(new Uint8Array(require("../deployer.json")));

  const tokenMintA = new PublicKey("J1q7FEiMhzgd1T9bGtdh8ZTZa8mhsyszaW4AqQPvYxWX");

  const userA = Keypair.fromSecretKey(new Uint8Array(require("../deployer.json")));
  const userB = Keypair.fromSecretKey(new Uint8Array(require("../use.json")));



  const payrollId = "company_payroll_3";
  const paymentToken = tokenMintA;
  const taxRate = 2000; // 20% in basis points (0.2 * 10000)
  const salaryAmount = new BN(5000 * 1_000_000_000); // 5000 tokens (9 decimals)
  const deductions = new BN(200 * 1_000_000_000); // 200 tokens
  const paymentFrequency = { monthly: {} };
  const generateEmployeeId = (): string => `emp_${Math.floor(1000 + Math.random() * 9000)}`;
  const employeeId1 = generateEmployeeId();
  const employeeId2 = generateEmployeeId();

  // Account variables
  let payroll: PublicKey;
  let payrollVault: PublicKey;
  let employee1 = userA;
  let employee1Wallet: PublicKey;
  let employee2 = userB;
  let employee2Wallet: PublicKey;
  let authorityWallet: PublicKey;
  let employee1Pda: PublicKey;
  let employee2Pda: PublicKey;

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


    const tx = new Transaction();
    for (const wallet of [authorityWallet, employee1Wallet, employee2Wallet]) {
      const accountInfo = await provider.connection.getAccountInfo(wallet);
      if (!accountInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            authority.publicKey,
            wallet,
            wallet.equals(authorityWallet) ? authority.publicKey : wallet.equals(employee1Wallet) ? employee1.publicKey : employee2.publicKey,
            paymentToken,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }
    }
    if (tx.instructions.length > 0) {
      await provider.sendAndConfirm!(tx, [authority]);
    }

    // Derive PDAs
    [payroll] = PublicKey.findProgramAddressSync(
      [Buffer.from("payroll"), Buffer.from(payrollId)],
      program.programId
    );

    [payrollVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), payroll.toBuffer()],
      program.programId
    );

    [employee1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("employee"), payroll.toBuffer(), Buffer.from(employeeId1)],
      program.programId
    );

    [employee2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("employee"), payroll.toBuffer(), Buffer.from(employeeId2)],
      program.programId
    );


  });

  it.skip("Initializes payroll", async () => {

    const txSPL = await program.methods
      .initializePayroll(payrollId, paymentToken, taxRate)
      .accounts({
        payroll,
        payrollVault,
        paymentToken,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([authority])
      .rpc();

    console.log("initializePayroll txn signature:", txSPL);

    const payrollAccount = await program.account.payroll.fetch(payroll);
    assert.equal(payrollAccount.authority.toString(), authority.publicKey.toString());
    assert.equal(payrollAccount.payrollId, payrollId);
    assert.equal(payrollAccount.paymentToken.toString(), paymentToken.toString());
    assert.equal(payrollAccount.employeeCount.toNumber(), 0);
    assert.isTrue(payrollAccount.isActive);
    assert.equal(payrollAccount.taxRate, taxRate);
    assert.equal(payrollAccount.totalFunds.toNumber(), 0);

    const vaultAccount = await getAccount(provider.connection, payrollVault);
    assert.equal(vaultAccount.mint.toString(), paymentToken.toString());

  });

  it.skip("Fails to initialize with invalid payroll ID", async () => {
    const invalidPayrollId = "a".repeat(65); // 65 characters long
    const [invalidPayrollPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("payroll"), Buffer.from(invalidPayrollId)],
      program.programId
    );

    try {
      await program.methods
        .initializePayroll(invalidPayrollId, paymentToken, taxRate)
        .accounts({
          payroll: invalidPayrollPda,
          payrollVault: payrollVault,
          paymentToken,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "InvalidPayrollId");
    }
  });


  it("Adds employee successfully", async () => {
    await program.methods
      .addEmployee(employeeId1, salaryAmount, paymentFrequency, deductions)
      .accounts({
        payroll,
        employee: employee1Pda,
        employeeWallet: employee1Wallet,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([authority])
      .rpc();

    const employeeAccount = await program.account.employee.fetch(employee1Pda);
    assert.equal(employeeAccount.payroll.toString(), payroll.toString());
    assert.equal(employeeAccount.employeeId, employeeId1);
    assert.equal(employeeAccount.wallet.toString(), employee1Wallet.toString());
    assert.equal(employeeAccount.salaryAmount.toString(), salaryAmount.toString());
    assert.equal(employeeAccount.deductions.toString(), deductions.toString());
    assert.deepEqual(employeeAccount.paymentFrequency, paymentFrequency);
    assert.equal(employeeAccount.lastPayment.toNumber(), 0);
    assert.isTrue(employeeAccount.isActive);

    const payrollAccount = await program.account.payroll.fetch(payroll);
    // assert.equal(payrollAccount.employeeCount.toNumber(), 1);
  });


  it("Fails to add employee to inactive payroll", async () => {
    await program.methods
      .pausePayroll()
      .accounts({
        payroll,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();

    try {
      await program.methods
        .addEmployee(employeeId2, salaryAmount, paymentFrequency, deductions)
        .accounts({
          payroll,
          employee: employee2Pda,
          employeeWallet: employee2Wallet,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "PayrollInactive");
    }

    await program.methods
      .resumePayroll()
      .accounts({
        payroll,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();
  });


  it("Fails to add employee with invalid ID", async () => {
    const invalidEmployeeId = "invalid_emp_id_1234567890123456789012345678901234567890"; // 65 characters long
    const [invalidEmployeePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("employee"), payroll.toBuffer(), Buffer.from(invalidEmployeeId)],
      program.programId
    );

    try {
      await program.methods
        .addEmployee(invalidEmployeeId, salaryAmount, paymentFrequency, deductions)
        .accounts({
          payroll,
          employee: invalidEmployeePda,
          employeeWallet: employee1Wallet,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "InvalidEmployeeId");
    }
  });


  it.skip("Fails to add employee with zero salary", async () => {
    try {
      await program.methods
        .addEmployee(employeeId2, new BN(0), paymentFrequency, deductions)
        .accounts({
          payroll,
          employee: employee2Pda,
          employeeWallet: employee2Wallet,
          authority: authority.publicKey,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "InvalidSalaryAmount");
    }
  });

  it("Adds second employee successfully", async () => {
    await program.methods
      .addEmployee(employeeId2, salaryAmount, paymentFrequency, deductions)
      .accounts({
        payroll,
        employee: employee2Pda,
        employeeWallet: employee2Wallet,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([authority])
      .rpc();

    const payrollAccount = await program.account.payroll.fetch(payroll);
    //assert.equal(payrollAccount.employeeCount.toNumber(), 2);
  });


  it("Deposits funds successfully", async () => {
    const depositAmount = new BN(10000 * 1_000_000_000); // 10000 tokens
    await program.methods
      .depositFunds(depositAmount)
      .accounts({
        payroll,
        payrollVault,
        authorityTokenAccount: authorityWallet,
        paymentToken,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([authority])
      .rpc();

    const payrollAccount = await program.account.payroll.fetch(payroll);
    console.log("Payroll account:", payrollAccount);
    //assert.equal(payrollAccount.totalFunds.toString(), depositAmount.toString());

    const vaultAccount = await getAccount(provider.connection, payrollVault);
    console.log("Vault account:", vaultAccount);
    //assert.equal(vaultAccount.amount.toString(), depositAmount.toString());
  });


  it.skip("Fails to deposit zero amount", async () => {
    try {
      await program.methods
        .depositFunds(new BN(0))
        .accounts({
          payroll,
          payrollVault,
          authorityTokenAccount: authorityWallet,
          paymentToken,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "Amount must be greater than zero");
    }
  });

  it("Processes payment successfully", async () => {
    const employeeAccountBefore = await program.account.employee.fetch(employee1Pda);
    const vaultAccountBefore = await getAccount(provider.connection, payrollVault);
    const employeeWalletBefore = await getAccount(provider.connection, employee1Wallet);

    await program.methods
      .processPayment(employeeId1)
      .accounts({
        payroll,
        employee: employee1Pda,
        payrollVault,
        employeeWallet: employee1Wallet,
        paymentToken,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([authority])
      .rpc();

    const employeeAccountAfter = await program.account.employee.fetch(employee1Pda);
    const vaultAccountAfter = await getAccount(provider.connection, payrollVault);
    const employeeWalletAfter = await getAccount(provider.connection, employee1Wallet);
    const payrollAccount = await program.account.payroll.fetch(payroll);

    const taxAmount = salaryAmount
      .mul(new BN(taxRate))
      .div(new BN(10_000));
    const netPayment = salaryAmount.sub(taxAmount).sub(deductions);

    assert.notEqual(
      employeeAccountAfter.lastPayment.toNumber(),
      employeeAccountBefore.lastPayment.toNumber()
    );
    // assert.equal(
    //   vaultAccountAfter.amount.toString(),
    //   new BN(vaultAccountBefore.amount.toString()).sub(netPayment).toString()
    // );
    // assert.equal(
    //   employeeWalletAfter.amount.toString(),
    //   (employeeWalletBefore.amount + BigInt(netPayment.toString())).toString()
    // );
    // assert.equal(
    //   payrollAccount.totalFunds.toString(),
    //   new BN(vaultAccountBefore.amount.toString()).sub(netPayment).toString()
    // );
  });

  it("Fails to process payment for inactive payroll", async () => {
    await program.methods
      .pausePayroll()
      .accounts({
        payroll,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();

    try {
      await program.methods
        .processPayment(employeeId1)
        .accounts({
          payroll,
          employee: employee1Pda,
          payrollVault,
          employeeWallet: employee1Wallet,
          paymentToken,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "PayrollInactive");
    }

    await program.methods
      .resumePayroll()
      .accounts({
        payroll,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();
  });

  it("Fails to process payment for inactive employee", async () => {
    await program.methods
      .updateEmployee(salaryAmount, paymentFrequency, deductions, false)
      .accounts({
        payroll,
        employee: employee1Pda,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();

    try {
      await program.methods
        .processPayment(employeeId1)
        .accounts({
          payroll,
          employee: employee1Pda,
          payrollVault,
          employeeWallet: employee1Wallet,
          paymentToken,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "EmployeeInactive");
    }

    await program.methods
      .updateEmployee(salaryAmount, paymentFrequency, deductions, true)
      .accounts({
        payroll,
        employee: employee1Pda,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();
  });

  it("Fails to process payment too soon", async () => {
    try {
      await program.methods
        .processPayment(employeeId1)
        .accounts({
          payroll,
          employee: employee1Pda,
          payrollVault,
          employeeWallet: employee1Wallet,
          paymentToken,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "PaymentTooSoon");
    }
  });


  it("Fails to process payment with invalid employee ID", async () => {
    try {
      await program.methods
        .processPayment("invalid_emp")
        .accounts({
          payroll,
          employee: employee1Pda,
          payrollVault,
          employeeWallet: employee1Wallet,
          paymentToken,
          authority: authority.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "InvalidEmployeeId");
    }
  });


  it("Updates employee successfully", async () => {
    const newSalaryAmount = new BN(6000 * 1_000_000_000);
    const newDeductions = new BN(300 * 1_000_000_000);
    const newFrequency = { weekly: {} };
    const newIsActive = false;

    await program.methods
      .updateEmployee(newSalaryAmount, newFrequency, newDeductions, newIsActive)
      .accounts({
        payroll,
        employee: employee1Pda,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();

    const employeeAccount = await program.account.employee.fetch(employee1Pda);
    assert.equal(employeeAccount.salaryAmount.toString(), newSalaryAmount.toString());
    assert.equal(employeeAccount.deductions.toString(), newDeductions.toString());
    assert.deepEqual(employeeAccount.paymentFrequency, newFrequency);
    assert.isFalse(employeeAccount.isActive);
  });

  it("Fails to update employee in inactive payroll", async () => {
    await program.methods
      .pausePayroll()
      .accounts({
        payroll,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();

    try {
      await program.methods
        .updateEmployee(salaryAmount, paymentFrequency, deductions, true)
        .accounts({
          payroll,
          employee: employee1Pda,
          authority: authority.publicKey,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "PayrollInactive");
    }

    await program.methods
      .resumePayroll()
      .accounts({
        payroll,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();
  });

  it("Fails to update employee with zero salary", async () => {
    try {
      await program.methods
        .updateEmployee(new BN(0), paymentFrequency, deductions, true)
        .accounts({
          payroll,
          employee: employee1Pda,
          authority: authority.publicKey,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "InvalidSalaryAmount");
    }
  });

  it("Pauses payroll successfully", async () => {
    await program.methods
      .pausePayroll()
      .accounts({
        payroll,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();

    const payrollAccount = await program.account.payroll.fetch(payroll);
    assert.isFalse(payrollAccount.isActive);
  });

  it("Fails to pause already inactive payroll", async () => {
    try {
      await program.methods
        .pausePayroll()
        .accounts({
          payroll,
          authority: authority.publicKey,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "PayrollInactive");
    }
  });

  it("Resumes payroll successfully", async () => {
    await program.methods
      .resumePayroll()
      .accounts({
        payroll,
        authority: authority.publicKey,
      } as any)
      .signers([authority])
      .rpc();

    const payrollAccount = await program.account.payroll.fetch(payroll);
    assert.isTrue(payrollAccount.isActive);
  });

  it("Fails to resume already active payroll", async () => {
    try {
      await program.methods
        .resumePayroll()
        .accounts({
          payroll,
          authority: authority.publicKey,
        } as any)
        .signers([authority])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.toString(), "PayrollActive");
    }
  });
});

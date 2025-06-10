# Payroll Program

A Solana Anchor-based payroll management system, automated, and tokenized salary payments. This program enables organizations to manage payrolls, add employees, process payments, and handle tax and deduction logic using SPL tokens.

---

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Account Structure](#account-structure)
- [Instructions](#instructions)
  - [Deployment](#deployment)
  - [Initialization](#initialization)
  - [Adding Employees](#adding-employees)
  - [Processing Payments](#processing-payments)
  - [Updating Employees](#updating-employees)
  - [Depositing Funds](#depositing-funds)
  - [Pausing/Resuming Payroll](#pausingresuming-payroll)
- [Events](#events)
- [Error Codes](#error-codes)
- [Security Considerations](#security-considerations)
- [License](#license)

---

## Overview

This program provides a robust, on-chain payroll system for organizations to manage employee payments using SPL tokens. It supports:
- employee management
- Automated salary, tax, and deduction calculations
- Flexible payment frequencies (weekly, bi-weekly, monthly)
- Secure fund vaults and authority controls

## Features
- **Payroll Vaults:** Each payroll has a dedicated SPL token vault.
- **Employee Management:** Add, update, and deactivate employees with custom salary, deductions, and payment frequency.
- **Automated Payments:** Enforce payment intervals and calculate net salary (after tax and deductions).
- **Event Logging:** Emits events for all major actions for off-chain tracking.
- **Pause/Resume:** Temporarily pause or resume payroll operations.

## Account Structure

### Accounts
- **Payroll**: Stores payroll configuration and state.
- **Employee**: Stores individual employee data.
- **Payroll Vault**: SPL Token account holding payroll funds.

### Data Layout
#### Payroll
- `authority: Pubkey` — Payroll admin
- `payroll_id: String` — Unique identifier
- `payment_token: Pubkey` — SPL token mint
- `employee_count: u64` — Number of employees
- `is_active: bool` — Payroll status
- `tax_rate: u16` — Basis points (e.g., 1000 = 10%)
- `total_funds: u64` — Funds in vault

#### Employee
- `payroll: Pubkey` — Parent payroll
- `employee_id: String` — Unique identifier
- `wallet: Pubkey` — Employee's token account
- `salary_amount: u64` — Gross salary per period
- `deductions: u64` — Fixed deductions per period
- `payment_frequency: PaymentFrequency` — Enum: Weekly, BiWeekly, Monthly
- `last_payment: i64` — Unix timestamp
- `is_active: bool` — Employment status

## Instructions

### Deployment
1. **Build the program:**
   ```sh
   anchor build
   ```
2. **Deploy to Solana:**
   ```sh
   anchor deploy
   ```
3. **Update your client with the new program ID.**

### Initialization
- **Initialize Payroll**
  - Creates a new payroll and associated vault.
  - Parameters: `payroll_id`, `payment_token`, `tax_rate`

### Adding Employees
- **Add Employee**
  - Adds a new employee to a payroll.
  - Parameters: `employee_id`, `salary_amount`, `payment_frequency`, `deductions`

### Processing Payments
- **Process Payment**
  - Pays an employee if the required interval has passed.
  - Calculates net salary: `salary - tax - deductions`
  - Transfers SPL tokens from payroll vault to employee wallet.

### Updating Employees
- **Update Employee**
  - Modify salary, frequency, deductions, or active status.

### Depositing Funds
- **Deposit Funds**
  - Transfer SPL tokens from authority to payroll vault.

### Pausing/Resuming Payroll
- **Pause Payroll**
  - Temporarily disables all payment actions.
- **Resume Payroll**
  - Re-enables payment actions.

## Events
- `EmployeeAdded`
- `EmployeeUpdated`
- `PaymentProcessed`
- `FundsDeposited`
- `PayrollPaused`
- `PayrollResumed`

## Error Codes
- `PayrollInactive` — Payroll is paused
- `PayrollActive` — Payroll is already active
- `EmployeeInactive` — Employee is not active
- `InvalidPayroll` — Invalid payroll account
- `InvalidEmployeeId` — Employee ID mismatch
- `PaymentTooSoon` — Payment interval not met
- `InvalidWallet` — Wallet mismatch
- `ArithmeticOverflow` — Math error
- `InvalidPayrollId` — Payroll ID mismatch
- `InvalidSalaryAmount` — Salary must be > 0
- `InsufficientFunds` — Not enough funds in vault

## Security Considerations
- **Authority Controls:** Only the payroll authority can add employees, deposit funds, or pause/resume payroll.
- **Token Transfers:** All payments use SPL token transfers with proper signer seeds.
- **Overflow Checks:** All arithmetic uses checked operations to prevent overflows.
- **Event Logging:** All critical actions emit events for transparency and off-chain monitoring.

## License

MIT 
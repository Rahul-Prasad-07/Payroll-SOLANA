/**
 * Payroll Standard Program
 *
 * Overview:
 * This smart contract implements a standard payroll system on the Solana blockchain using the Anchor framework.
 * It supports payroll initialization, employee management, payment processing, fund deposits, and the ability
 * to pause/resume payroll operations. Note that this is a standard payroll system and does not handle any confidential data.
 *
 * Functionalities:
 *
 * 1. initialize_payroll:
 *    - Sets up a new payroll vault with a unique payroll ID, assigns the payment token, establishes the payroll authority,
 *      initial employee count, taxonomy (active/inactive), tax rate, and total funds.
 *
 * 2. add_employee:
 *    - Adds a new employee record to an active payroll by linking the employee wallet with their payroll.
 *    - Configures employee details including salary, payment frequency, and deductions.
 *    - Increments the employee count and emits an EmployeeAdded event.
 *
 * 3. process_payment:
 *    - Processes salary payments for an employee, ensuring that the payroll and employee are both active.
 *    - Validates that the payment interval (based on the employee's payment frequency) has passed since the last payment.
 *    - Calculates net payment by deducting tax and any specified deductions.
 *    - Executes an SPL token transfer from the payroll vault to the employee's wallet.
 *    - Updates the payroll fund balance and the employee's last payment timestamp, and emits a PaymentProcessed event.
 *
 * 4. update_employee:
 *    - Enables modification of an employee’s salary, payment frequency, deductions, and active status.
 *    - Emits an EmployeeUpdated event to reflect any changes made.
 *
 * 5. deposit_funds:
 *    - Deposits funds into the payroll vault using an SPL token transfer from the payroll authority's token account.
 *    - Updates the internal tracking of total payroll funds and emits a FundsDeposited event.
 *
 * 6. pause_payroll and resume_payroll:
 *    - These functions are used to temporarily suspend (pause) or resume the payroll.
 *    - They change the active status of the payroll and emit PayrollPaused or PayrollResumed events accordingly.
 *
 * Key Data Structures:
 *
 * - Payroll:
 *   Represents the payroll vault, containing information such as the authority, payroll ID, payment token,
 *   employee count, active status, tax rate, and total funds available.
 *
 * - Employee:
 *   Stores employee-specific data, including payroll linkage, employee ID, wallet details, salary, deductions,
 *   frequency of salary payments, timestamp of the last payment, and activation status.
 *
 * - PaymentFrequency:
 *   An enumeration defining the options for payment intervals (Weekly, BiWeekly, or Monthly).
 *
 * Error Handling:
 *
 * The contract includes custom errors (e.g., PayrollInactive, EmployeeInactive, ArithmeticOverflow, InsufficientFunds) 
 * to provide clear failure messages and prevent invalid operations.
 *
 * Events:
 *
 * The program emits events like EmployeeAdded, PaymentProcessed, EmployeeUpdated, FundsDeposited, PayrollPaused,
 * and PayrollResumed to enable off-chain services and listeners to track payroll state changes.
 *
 * Note:
 * This contract is intended for a standard, public payroll management system and is designed with transparency in mind.
 */

- `anchor build -- -- -Znext-lockfile-bump`
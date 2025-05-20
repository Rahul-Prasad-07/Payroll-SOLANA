/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/payroll_standard.json`.
 */
export type PayrollStandard = {
  "address": "3CkB1YhoBxHG9uZXJ3fDkjshjb9nXdFQkLSKKNYz9vX7",
  "metadata": {
    "name": "payrollStandard",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addEmployee",
      "discriminator": [
        14,
        82,
        239,
        156,
        50,
        90,
        189,
        61
      ],
      "accounts": [
        {
          "name": "payroll",
          "writable": true
        },
        {
          "name": "employee",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  109,
                  112,
                  108,
                  111,
                  121,
                  101,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "payroll"
              },
              {
                "kind": "arg",
                "path": "employeeId"
              }
            ]
          }
        },
        {
          "name": "employeeWallet"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "payroll"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "employeeId",
          "type": "string"
        },
        {
          "name": "salaryAmount",
          "type": "u64"
        },
        {
          "name": "paymentFrequency",
          "type": {
            "defined": {
              "name": "paymentFrequency"
            }
          }
        },
        {
          "name": "deductions",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositFunds",
      "discriminator": [
        202,
        39,
        52,
        211,
        53,
        20,
        250,
        88
      ],
      "accounts": [
        {
          "name": "payroll",
          "writable": true
        },
        {
          "name": "payrollVault",
          "writable": true
        },
        {
          "name": "authorityTokenAccount",
          "writable": true
        },
        {
          "name": "paymentToken",
          "relations": [
            "payroll"
          ]
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "payroll"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializePayroll",
      "discriminator": [
        167,
        26,
        70,
        176,
        167,
        66,
        216,
        138
      ],
      "accounts": [
        {
          "name": "payroll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  114,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "payrollId"
              }
            ]
          }
        },
        {
          "name": "payrollVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "payroll"
              }
            ]
          }
        },
        {
          "name": "paymentToken"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "payrollId",
          "type": "string"
        },
        {
          "name": "paymentToken",
          "type": "pubkey"
        },
        {
          "name": "taxRate",
          "type": "u16"
        }
      ]
    },
    {
      "name": "pausePayroll",
      "discriminator": [
        77,
        167,
        122,
        250,
        144,
        199,
        60,
        243
      ],
      "accounts": [
        {
          "name": "payroll",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "payroll"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "processPayment",
      "discriminator": [
        189,
        81,
        30,
        198,
        139,
        186,
        115,
        23
      ],
      "accounts": [
        {
          "name": "payroll",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  114,
                  111,
                  108,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "payroll.payroll_id",
                "account": "payroll"
              }
            ]
          }
        },
        {
          "name": "employee",
          "writable": true
        },
        {
          "name": "payrollVault",
          "writable": true
        },
        {
          "name": "employeeWallet",
          "writable": true
        },
        {
          "name": "paymentToken",
          "relations": [
            "payroll"
          ]
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "payroll"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "employeeId",
          "type": "string"
        }
      ]
    },
    {
      "name": "resumePayroll",
      "discriminator": [
        66,
        189,
        169,
        90,
        216,
        243,
        136,
        57
      ],
      "accounts": [
        {
          "name": "payroll",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "payroll"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "updateEmployee",
      "discriminator": [
        73,
        4,
        138,
        145,
        85,
        224,
        29,
        186
      ],
      "accounts": [
        {
          "name": "payroll"
        },
        {
          "name": "employee",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "payroll"
          ]
        }
      ],
      "args": [
        {
          "name": "salaryAmount",
          "type": "u64"
        },
        {
          "name": "paymentFrequency",
          "type": {
            "defined": {
              "name": "paymentFrequency"
            }
          }
        },
        {
          "name": "deductions",
          "type": "u64"
        },
        {
          "name": "isActive",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "employee",
      "discriminator": [
        98,
        238,
        61,
        252,
        130,
        77,
        105,
        67
      ]
    },
    {
      "name": "payroll",
      "discriminator": [
        194,
        86,
        146,
        159,
        169,
        29,
        234,
        51
      ]
    }
  ],
  "events": [
    {
      "name": "employeeAdded",
      "discriminator": [
        33,
        182,
        133,
        249,
        156,
        132,
        180,
        176
      ]
    },
    {
      "name": "employeeUpdated",
      "discriminator": [
        15,
        12,
        101,
        103,
        9,
        167,
        130,
        169
      ]
    },
    {
      "name": "fundsDeposited",
      "discriminator": [
        157,
        209,
        100,
        95,
        59,
        100,
        3,
        68
      ]
    },
    {
      "name": "paymentProcessed",
      "discriminator": [
        22,
        109,
        191,
        213,
        83,
        63,
        120,
        219
      ]
    },
    {
      "name": "payrollPaused",
      "discriminator": [
        34,
        233,
        200,
        117,
        26,
        62,
        130,
        220
      ]
    },
    {
      "name": "payrollResumed",
      "discriminator": [
        202,
        200,
        197,
        44,
        92,
        194,
        192,
        116
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "payrollInactive",
      "msg": "Payroll is not active"
    },
    {
      "code": 6001,
      "name": "payrollActive",
      "msg": "Payroll is already active"
    },
    {
      "code": 6002,
      "name": "employeeInactive",
      "msg": "Employee is not active"
    },
    {
      "code": 6003,
      "name": "invalidPayroll",
      "msg": "Invalid payroll account"
    },
    {
      "code": 6004,
      "name": "invalidEmployeeId",
      "msg": "Invalid employee ID"
    },
    {
      "code": 6005,
      "name": "paymentTooSoon",
      "msg": "Payment attempted too soon"
    },
    {
      "code": 6006,
      "name": "invalidWallet",
      "msg": "Invalid wallet account"
    },
    {
      "code": 6007,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow occurred"
    },
    {
      "code": 6008,
      "name": "invalidPayrollId",
      "msg": "Invalid payroll ID"
    },
    {
      "code": 6009,
      "name": "invalidSalaryAmount",
      "msg": "Invalid salary amount"
    },
    {
      "code": 6010,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in vault"
    }
  ],
  "types": [
    {
      "name": "employee",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payroll",
            "type": "pubkey"
          },
          {
            "name": "employeeId",
            "type": "string"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "salaryAmount",
            "type": "u64"
          },
          {
            "name": "deductions",
            "type": "u64"
          },
          {
            "name": "paymentFrequency",
            "type": {
              "defined": {
                "name": "paymentFrequency"
              }
            }
          },
          {
            "name": "lastPayment",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "employeeAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payrollId",
            "type": "string"
          },
          {
            "name": "employeeId",
            "type": "string"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "salaryAmount",
            "type": "u64"
          },
          {
            "name": "deductions",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "employeeUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payrollId",
            "type": "string"
          },
          {
            "name": "employeeId",
            "type": "string"
          },
          {
            "name": "salaryAmount",
            "type": "u64"
          },
          {
            "name": "deductions",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "fundsDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payrollId",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "paymentFrequency",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "weekly"
          },
          {
            "name": "biWeekly"
          },
          {
            "name": "monthly"
          }
        ]
      }
    },
    {
      "name": "paymentProcessed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payrollId",
            "type": "string"
          },
          {
            "name": "employeeId",
            "type": "string"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "taxAmount",
            "type": "u64"
          },
          {
            "name": "deductions",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "payroll",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "payrollId",
            "type": "string"
          },
          {
            "name": "paymentToken",
            "type": "pubkey"
          },
          {
            "name": "employeeCount",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "taxRate",
            "type": "u16"
          },
          {
            "name": "totalFunds",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "payrollPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payrollId",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "payrollResumed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payrollId",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solana.json`.
 */
export type Solana = {
  "address": "BwzroF85PpoMMjmvYBgvdtXRggJUNUs6sfw6LydFjTEj",
  "metadata": {
    "name": "solana",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "buy",
      "discriminator": [
        102,
        6,
        61,
        18,
        1,
        218,
        235,
        234
      ],
      "accounts": [
        {
          "name": "bondingCurve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  105,
                  110,
                  103,
                  45,
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "buyerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "wsolMint",
          "docs": [
            "The wrapped SOL mint"
          ],
          "address": "So11111111111111111111111111111111111111112"
        },
        {
          "name": "buyerWsolAccount",
          "docs": [
            "Buyer's wrapped SOL account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "bondingCurveWsolAccount",
          "docs": [
            "Bonding curve's wrapped SOL account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bondingCurve"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usingNativeSol",
          "docs": [
            "Flag to indicate if the buyer is using native SOL or wrapped SOL",
            "Changed to a signer check instead of a boolean to avoid anchor issues"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
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
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "deployCreatorToken",
      "discriminator": [
        21,
        136,
        226,
        212,
        194,
        63,
        198,
        0
      ],
      "accounts": [
        {
          "name": "entryPoint",
          "writable": true
        },
        {
          "name": "creatorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  45,
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "config.handle"
              }
            ]
          }
        },
        {
          "name": "nftAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  102,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "entry_point.next_token_id",
                "account": "attenomicsEntryPoint"
              }
            ]
          }
        },
        {
          "name": "aiAgentAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  45,
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "config.ai_agent"
              }
            ]
          }
        },
        {
          "name": "selfTokenVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  108,
                  102,
                  45,
                  116,
                  111,
                  107,
                  101,
                  110,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "bondingCurve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  105,
                  110,
                  103,
                  45,
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "supporterContract",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  112,
                  112,
                  111,
                  114,
                  116,
                  101,
                  114,
                  45,
                  99,
                  111,
                  110,
                  116,
                  114,
                  97,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
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
          "name": "config",
          "type": {
            "defined": {
              "name": "tokenConfig"
            }
          }
        },
        {
          "name": "distributorConfigBytes",
          "type": "bytes"
        },
        {
          "name": "vaultConfigBytes",
          "type": "bytes"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "nftMetadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "* @notice Initializes the Attenomics Creator Tokens entry point\n     * @param protocol_fee_address The address that will receive protocol fees\n     *\n     * This function sets up the global entry point for the protocol that tracks\n     * registered AI agents, creator tokens, and handles protocol-wide configuration."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "entryPoint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  116,
                  114,
                  121,
                  45,
                  112,
                  111,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "gasliteDrop"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "protocolFeeAddress",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeSwapRouter",
      "discriminator": [
        13,
        95,
        4,
        39,
        142,
        86,
        45,
        185
      ],
      "accounts": [
        {
          "name": "swapRouter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  97,
                  112,
                  45,
                  114,
                  111,
                  117,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "mintInitialTokens",
      "discriminator": [
        5,
        7,
        34,
        31,
        254,
        204,
        62,
        174
      ],
      "accounts": [
        {
          "name": "creatorTokenAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  114,
                  101,
                  97,
                  116,
                  111,
                  114,
                  45,
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "creator_token_account.handle",
                "account": "creatorTokenAccount"
              }
            ]
          }
        },
        {
          "name": "bondingCurve",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  105,
                  110,
                  103,
                  45,
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "selfTokenVault"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "supporterTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "supporterContract"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "selfTokenVault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  108,
                  102,
                  45,
                  116,
                  111,
                  107,
                  101,
                  110,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "supporterContract",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  117,
                  112,
                  112,
                  111,
                  114,
                  116,
                  101,
                  114,
                  45,
                  99,
                  111,
                  110,
                  116,
                  114,
                  97,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "sell",
      "discriminator": [
        51,
        230,
        133,
        164,
        1,
        127,
        131,
        173
      ],
      "accounts": [
        {
          "name": "bondingCurve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  105,
                  110,
                  103,
                  45,
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenMint",
          "writable": true
        },
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "sellerTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "wsolMint",
          "docs": [
            "The wrapped SOL mint"
          ],
          "address": "So11111111111111111111111111111111111111112"
        },
        {
          "name": "sellerWsolAccount",
          "docs": [
            "Seller's wrapped SOL account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "bondingCurveWsolAccount",
          "docs": [
            "Bonding curve's wrapped SOL account"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "bondingCurve"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
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
      "name": "setAiAgent",
      "docs": [
        "* @notice Registers or updates an AI agent's permission status\n     * @param agent The public key of the AI agent to register\n     * @param allowed Whether the agent is allowed to interact with the protocol\n     *\n     * Only the protocol authority can register AI agents. Registered agents\n     * can perform privileged actions like distributing tokens to supporters."
      ],
      "discriminator": [
        216,
        84,
        162,
        148,
        34,
        254,
        48,
        3
      ],
      "accounts": [
        {
          "name": "entryPoint",
          "writable": true
        },
        {
          "name": "agentAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  45,
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent"
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "agent"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agent",
          "type": "pubkey"
        },
        {
          "name": "allowed",
          "type": "bool"
        }
      ]
    },
    {
      "name": "swapTokens",
      "discriminator": [
        201,
        226,
        234,
        16,
        70,
        155,
        131,
        206
      ],
      "accounts": [
        {
          "name": "swapRouter",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  97,
                  112,
                  45,
                  114,
                  111,
                  117,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "sourceBondingCurve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  105,
                  110,
                  103,
                  45,
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "sourceTokenMint"
              }
            ]
          }
        },
        {
          "name": "sourceTokenMint",
          "writable": true
        },
        {
          "name": "targetBondingCurve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  111,
                  110,
                  100,
                  105,
                  110,
                  103,
                  45,
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "targetTokenMint"
              }
            ]
          }
        },
        {
          "name": "targetTokenMint",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userSourceTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "sourceTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userTargetTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "targetTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "sourceBondingCurveWsolAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "sourceBondingCurve"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "targetBondingCurveWsolAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "targetBondingCurve"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "wsolMint",
          "address": "So11111111111111111111111111111111111111112"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "minAmountOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "aiAgentAccount",
      "discriminator": [
        82,
        88,
        69,
        247,
        25,
        201,
        191,
        142
      ]
    },
    {
      "name": "attenomicsEntryPoint",
      "discriminator": [
        169,
        31,
        209,
        240,
        75,
        129,
        146,
        53
      ]
    },
    {
      "name": "bondingCurve",
      "discriminator": [
        23,
        183,
        248,
        55,
        96,
        216,
        172,
        96
      ]
    },
    {
      "name": "creatorTokenAccount",
      "discriminator": [
        140,
        62,
        67,
        150,
        11,
        178,
        242,
        22
      ]
    },
    {
      "name": "creatorTokenSupporter",
      "discriminator": [
        137,
        189,
        198,
        36,
        48,
        188,
        194,
        181
      ]
    },
    {
      "name": "nftAccount",
      "discriminator": [
        45,
        29,
        251,
        53,
        216,
        110,
        121,
        151
      ]
    },
    {
      "name": "selfTokenVault",
      "discriminator": [
        37,
        223,
        161,
        26,
        10,
        251,
        197,
        108
      ]
    },
    {
      "name": "swapRouter",
      "discriminator": [
        30,
        95,
        255,
        237,
        41,
        217,
        245,
        175
      ]
    }
  ],
  "events": [
    {
      "name": "aiAgentUpdated",
      "discriminator": [
        110,
        229,
        95,
        172,
        252,
        91,
        38,
        111
      ]
    },
    {
      "name": "bondingCurveUpdated",
      "discriminator": [
        116,
        21,
        81,
        125,
        252,
        184,
        143,
        118
      ]
    },
    {
      "name": "creatorTokenDeployed",
      "discriminator": [
        67,
        137,
        230,
        179,
        65,
        6,
        159,
        249
      ]
    },
    {
      "name": "swapRouterInitialized",
      "discriminator": [
        242,
        45,
        207,
        163,
        214,
        89,
        68,
        196
      ]
    },
    {
      "name": "tokenBought",
      "discriminator": [
        197,
        182,
        3,
        228,
        82,
        236,
        7,
        143
      ]
    },
    {
      "name": "tokenSold",
      "discriminator": [
        88,
        61,
        1,
        247,
        185,
        6,
        252,
        86
      ]
    },
    {
      "name": "tokensSwapped",
      "discriminator": [
        144,
        190,
        58,
        103,
        99,
        127,
        89,
        105
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "handleAlreadyUsed",
      "msg": "Handle already used"
    },
    {
      "code": 6002,
      "name": "aiAgentNotAllowed",
      "msg": "AI agent not allowed"
    },
    {
      "code": 6003,
      "name": "invalidGasliteDropAddress",
      "msg": "Invalid gaslite drop address"
    },
    {
      "code": 6004,
      "name": "invalidPercentageSplit",
      "msg": "Invalid percentage split"
    },
    {
      "code": 6005,
      "name": "noTokensAvailable",
      "msg": "No tokens available for withdrawal"
    },
    {
      "code": 6006,
      "name": "arithmeticError",
      "msg": "Arithmetic error"
    },
    {
      "code": 6007,
      "name": "insufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6008,
      "name": "insufficientFundsInCurve",
      "msg": "Insufficient funds in bonding curve"
    },
    {
      "code": 6009,
      "name": "slippageExceeded",
      "msg": "Slippage exceeded"
    },
    {
      "code": 6010,
      "name": "notInitialized",
      "msg": "Not initialized"
    },
    {
      "code": 6011,
      "name": "invalidBondingCurveParameters",
      "msg": "Invalid bonding curve parameters"
    },
    {
      "code": 6012,
      "name": "missingSigner",
      "msg": "Missing signer"
    },
    {
      "code": 6013,
      "name": "invalidInput",
      "msg": "Invalid input parameters"
    },
    {
      "code": 6014,
      "name": "signatureAlreadyUsed",
      "msg": "Signature already used"
    },
    {
      "code": 6015,
      "name": "invalidSignature",
      "msg": "Invalid signature"
    },
    {
      "code": 6016,
      "name": "invalidVaultConfig",
      "msg": "Invalid vault config"
    },
    {
      "code": 6017,
      "name": "invalidDistributorConfig",
      "msg": "Invalid distributor config"
    },
    {
      "code": 6018,
      "name": "tooEarly",
      "msg": "Too early"
    },
    {
      "code": 6019,
      "name": "inactiveAiAgent",
      "msg": "Inactive AI agent"
    },
    {
      "code": 6020,
      "name": "invalidAiAgent",
      "msg": "Invalid AI agent"
    },
    {
      "code": 6021,
      "name": "insufficientVirtualSupply",
      "msg": "Insufficient virtual token supply for purchase"
    }
  ],
  "types": [
    {
      "name": "aiAgentAccount",
      "docs": [
        "* @notice Stores information about registered AI agents\n * AI agents are trusted entities that can perform certain privileged operations"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "allowed",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "aiAgentUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "allowed",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "attenomicsEntryPoint",
      "docs": [
        "* @notice Main entry point account for the protocol\n * Stores global configuration and tracks token ID counter"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "gasliteDropAddress",
            "type": "pubkey"
          },
          {
            "name": "protocolFeeAddress",
            "type": "pubkey"
          },
          {
            "name": "nextTokenId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "bondingCurve",
      "docs": [
        "* @notice Implements the bonding curve mechanics\n * Handles token price discovery, buying, and selling logic"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "protocolFeeAddress",
            "type": "pubkey"
          },
          {
            "name": "buyFeePercent",
            "type": "u16"
          },
          {
            "name": "sellFeePercent",
            "type": "u16"
          },
          {
            "name": "purchaseMarketSupply",
            "type": "u64"
          },
          {
            "name": "lifetimeProtocolFees",
            "type": "u64"
          },
          {
            "name": "reserveRatio",
            "type": "u64"
          },
          {
            "name": "initialPrice",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "bondingCurveUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "reserveRatio",
            "type": "u64"
          },
          {
            "name": "initialPrice",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "creatorTokenAccount",
      "docs": [
        "* @notice Stores creator token metadata and references to its components\n * This is the core account for each creator token, linking all related accounts"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "handle",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "aiAgent",
            "type": "pubkey"
          },
          {
            "name": "totalSupply",
            "type": "u128"
          },
          {
            "name": "selfPercent",
            "type": "u8"
          },
          {
            "name": "marketPercent",
            "type": "u8"
          },
          {
            "name": "supporterPercent",
            "type": "u8"
          },
          {
            "name": "tokenId",
            "type": "u64"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "nftMetadataUri",
            "type": "string"
          },
          {
            "name": "initialized",
            "type": "bool"
          },
          {
            "name": "selfTokenVault",
            "type": "pubkey"
          },
          {
            "name": "bondingCurve",
            "type": "pubkey"
          },
          {
            "name": "supporterContract",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "creatorTokenDeployed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "tokenAddress",
            "type": "pubkey"
          },
          {
            "name": "handle",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "tokenId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "creatorTokenSupporter",
      "docs": [
        "* @notice Manages token distribution to supporters\n * Handles distribution of tokens allocated to community supporters"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "aiAgent",
            "type": "pubkey"
          },
          {
            "name": "gasliteDropAddress",
            "type": "pubkey"
          },
          {
            "name": "totalDistributed",
            "type": "u64"
          },
          {
            "name": "distributorConfig",
            "type": {
              "defined": {
                "name": "distributorConfig"
              }
            }
          },
          {
            "name": "lastDripTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "distributorConfig",
      "docs": [
        "* @notice Configuration for supporter token distribution\n * Defines the schedule for distributing tokens to supporters"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dailyDripAmount",
            "type": "u64"
          },
          {
            "name": "dripInterval",
            "type": "i64"
          },
          {
            "name": "totalDays",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "nftAccount",
      "docs": [
        "* @notice Tracks creator token NFT metadata\n * Each creator token has an associated NFT representing ownership"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "tokenId",
            "type": "u64"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "creatorToken",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "selfTokenVault",
      "docs": [
        "* @notice Manages creator token vesting\n * Handles the vesting schedule for tokens allocated to the creator"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "initialBalance",
            "type": "u128"
          },
          {
            "name": "withdrawn",
            "type": "u64"
          },
          {
            "name": "startTime",
            "type": "i64"
          },
          {
            "name": "initialized",
            "type": "bool"
          },
          {
            "name": "vaultConfig",
            "type": {
              "defined": {
                "name": "vaultConfig"
              }
            }
          }
        ]
      }
    },
    {
      "name": "swapRouter",
      "docs": [
        "* @notice Router for token-to-token swaps\n * Facilitates swapping between different creator tokens"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "initialized",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "swapRouterInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "router",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokenBought",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenConfig",
      "docs": [
        "* @notice Token configuration for deployment\n * Defines the initial settings for a new creator token"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "totalSupply",
            "type": "u128"
          },
          {
            "name": "selfPercent",
            "type": "u8"
          },
          {
            "name": "marketPercent",
            "type": "u8"
          },
          {
            "name": "supporterPercent",
            "type": "u8"
          },
          {
            "name": "handle",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "aiAgent",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokenSold",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokensSwapped",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "sourceToken",
            "type": "pubkey"
          },
          {
            "name": "targetToken",
            "type": "pubkey"
          },
          {
            "name": "amountIn",
            "type": "u64"
          },
          {
            "name": "amountOut",
            "type": "u64"
          },
          {
            "name": "solAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vaultConfig",
      "docs": [
        "* @notice Configuration for token vesting\n * Defines the schedule for token release from the vault"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "dripPercentage",
            "type": "u8"
          },
          {
            "name": "dripInterval",
            "type": "i64"
          },
          {
            "name": "lockTime",
            "type": "i64"
          },
          {
            "name": "lockedPercentage",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

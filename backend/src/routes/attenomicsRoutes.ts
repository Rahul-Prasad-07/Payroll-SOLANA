import { Router } from 'express';

import * as attenomicsController from '../controller/attenomicsController';

const router = Router();
router.get('/token-price', attenomicsController.getTokenPrice);
router.post('/initialize', attenomicsController.initialize);
router.post('/initialize-swap-router', attenomicsController.initializeSwapRouter);
router.post('/deploy-creator-token', attenomicsController.deployCreatorToken);
router.post('/buy', attenomicsController.buyTokens);
router.post('/sell', attenomicsController.sellTokens);
router.post('/swap-tokens', attenomicsController.swapTokens);
// router.post('/distribute-tokens', attenomicsController.distributeTokens);
// router.post('/distribute-with-signature', attenomicsController.distributeWithSignature);
// router.post('/provide-liquidity', attenomicsController.provideLiquidity);
// router.post('/update-bonding-curve', attenomicsController.updateBondingCurve);
// router.post('/withdraw', attenomicsController.withdraw);
// router.post('/withdraw-fees', attenomicsController.withdrawFees);
router.post('/set-ai-agent', attenomicsController.setAiAgent);
// router.post('/drip-tokens', attenomicsController.dripTokens);
// router.get('/available-for-withdrawal', attenomicsController.availableForWithdrawal);
// router.post('/get-handle-hash', attenomicsController.getHandleHash);
// router.post('/get-tokens-for-sol', attenomicsController.getTokensForSol);
// router.post('/get-sol-for-tokens', attenomicsController.getSolForTokens);

export default router;
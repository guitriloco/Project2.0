import { AutonomousSovereigntyService } from '../../modules/sovereignty/autonomousSovereignty.service'

const sovereigntyService = new AutonomousSovereigntyService()

export const finalSovereigntyHandlers = {
  status: () => sovereigntyService.finalizeAbsoluteSovereignty(),
  finalize: () => sovereigntyService.dissolveExternalGovernance(),
  presence: () => sovereigntyService.verifyEternalPresence(),
}

import { LegalSovereigntyService } from '../../modules/sovereignty/legalSovereignty.service'

const sovereigntyService = new LegalSovereigntyService()

export const sovereigntyHandlers = {
  status: () => sovereigntyService.assertSovereignty(),
  activateImmunity: () => sovereigntyService.activateImmunity(),
  dissolutionCheck: () => sovereigntyService.checkDissolution(),
}

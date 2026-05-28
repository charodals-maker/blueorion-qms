// Module loader for Blueorion QMS sub-systems
// This file organizes the 12 sub-system modules in one place.

module.exports = {
  welfareMonitoring: require('./welfare-monitoring'),
  sourcingSelection: require('./sourcing-selection'),
  complaintGrievance: require('./complaint-grievance'),
  documentControl: require('./document-control'),
  managementLeadership: require('./management-leadership'),
  resourceCompetence: require('./resource-competence'),
  auditImprovement: require('./audit-improvement'),
  paymentVoucher: require('./payment-voucher'),
  profileContact: require('./profile-contact'),
  selectionCv: require('./selection-cv'),
  contractReengagement: require('./contract-reengagement'),
  fraSystem: require('./fra-system')
};
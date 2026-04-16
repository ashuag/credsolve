export class LeadConfigurationException extends Error {
  constructor(public readonly resource: string) {
    super(resource);
    this.name = LeadConfigurationException.name;
  }
}

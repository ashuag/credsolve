export class OnboardingConfigurationException extends Error {
  constructor(public readonly resource: string) {
    super(resource);
    this.name = OnboardingConfigurationException.name;
  }
}

// Placeholder decorator to replace @thallesp/nestjs-better-auth while it's disabled
// This is a no-op decorator that does nothing but prevents import errors
export const AllowAnonymous = (): MethodDecorator & ClassDecorator => {
    return () => {
        // No-op: All routes are public while auth is disabled
    };
};

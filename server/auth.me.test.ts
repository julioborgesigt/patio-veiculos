import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const sampleUser: AuthenticatedUser = {
  id: 1,
  username: "sample-user",
  password: "deadbeef:cafebabe",
  email: "sample@example.com",
  name: "Sample User",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("auth.me", () => {
  it("never exposes the password hash", async () => {
    const caller = appRouter.createCaller(createContext(sampleUser));

    const result = await caller.auth.me();

    expect(result).toEqual({
      id: 1,
      username: "sample-user",
      name: "Sample User",
      role: "user",
    });
    expect(result).not.toHaveProperty("password");
  });

  it("returns null when there is no authenticated user", async () => {
    const caller = appRouter.createCaller(createContext(null));

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMemberData = (role: string, accessedServers: string[] = []) => ({
	id: "member-1",
	role,
	userId: "user-1",
	organizationId: "org-1",
	accessedServers,
	accessedProjects: [] as string[],
	accessedServices: [] as string[],
	accessedEnvironments: [] as string[],
	user: { id: "user-1", email: "test@test.com" },
});

let memberToReturn: ReturnType<typeof mockMemberData> =
	mockMemberData("member");

vi.mock("@dokploy/server/db", () => ({
	db: {
		query: {
			member: {
				findFirst: vi.fn(() => Promise.resolve(memberToReturn)),
			},
		},
	},
}));

const { canDeployToManager } = await import("@dokploy/server/services/server");

const session = {
	userId: "user-1",
	activeOrganizationId: "org-1",
};

describe("canDeployToManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("owner can deploy to manager", async () => {
		memberToReturn = mockMemberData("owner");
		const allowed = await canDeployToManager(session);
		expect(allowed).toBe(true);
	});

	it("admin can deploy to manager", async () => {
		memberToReturn = mockMemberData("admin");
		const allowed = await canDeployToManager(session);
		expect(allowed).toBe(true);
	});

	it("member without assigned servers can deploy to manager", async () => {
		memberToReturn = mockMemberData("member", []);
		const allowed = await canDeployToManager(session);
		expect(allowed).toBe(true);
	});

	it("member with assigned remote servers cannot deploy to manager", async () => {
		memberToReturn = mockMemberData("member", ["server-remote-1"]);
		const allowed = await canDeployToManager(session);
		expect(allowed).toBe(false);
	});
});

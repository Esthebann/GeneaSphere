import { POST as registerPOST } from "@/app/api/auth/register/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as treeGET } from "@/app/api/tree/route";
import { POST as membersPOST } from "@/app/api/members/route";
import { GET as memberGET, PATCH as memberPATCH } from "@/app/api/members/[id]/route";
import { startMemoryMongo, stopMemoryMongo, clearCollections } from "./helpers/db";
import { seedAdmin, seedUserUnvalidated } from "./helpers/auth";
import { signJwt, verifyJwt } from "@/lib/auth";

function reqJson(body: any, token?: string) {
  return new Request("http://localhost", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function reqAuth(method: string, token: string, body?: any) {
  return new Request("http://localhost", {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("backend minimum", () => {
  beforeAll(async () => {
    await startMemoryMongo();
  }, 20000);

  afterAll(async () => {
    await stopMemoryMongo();
  }, 20000);

  beforeEach(async () => {
    await clearCollections();
  });

  test("register: first user becomes ADMIN validated", async () => {
    const res = await registerPOST(reqJson({ email: "a@a.com", password: "Password123!" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.role).toBe("ADMIN");
    expect(json.isValidated).toBe(true);
  });

  test("login: unvalidated user blocked", async () => {
    await seedUserUnvalidated();
    const res = await loginPOST(reqJson({ email: "user@test.dev", password: "Password123!" }));
    expect(res.status).toBe(403);
  });

  test("protected route: /api/tree requires auth", async () => {
    const res = await treeGET(new Request("http://localhost", { method: "GET" }) as any);
    expect(res.status).toBe(401);
  });

  test("member create + optimistic locking conflict", async () => {
    const { token } = await seedAdmin();

    const createRes = await membersPOST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: "Jean", lastName: "Dupont", sex: "M", visibility: "PUBLIC" }),
      }) as any
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();

    const goodPatch = await memberPATCH(
      reqAuth("PATCH", token, { firstName: "Jean-Michel", version: 0 }) as any,
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(goodPatch.status).toBe(200);

    const badPatch = await memberPATCH(
      reqAuth("PATCH", token, { lastName: "Martin", version: 0 }) as any,
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(badPatch.status).toBe(409);
  });

  test("permissions PRIVATE: only owner or admin", async () => {
  const { token: adminToken } = await seedAdmin();

  const adminPayload = verifyJwt(adminToken);
  expect(adminPayload).toBeTruthy();

  const userToken = signJwt({
    userId: "000000000000000000000001",
    role: "USER",
    treeId: (adminPayload as any).treeId,
  });

  const created = await membersPOST(
    reqAuth("POST", adminToken, {
      firstName: "Secret",
      lastName: "Member",
      sex: "X",
      visibility: "PRIVATE",
    }) as any
  );
  expect(created.status).toBe(201);
  const createdJson = await created.json();

  const resUser = await memberGET(reqAuth("GET", userToken) as any, {
    params: Promise.resolve({ id: createdJson.id }),
  });
  expect(resUser.status).toBe(403);

  const resAdmin = await memberGET(reqAuth("GET", adminToken) as any, {
    params: Promise.resolve({ id: createdJson.id }),
  });
  expect(resAdmin.status).toBe(200);
});

});

/* Copyright (c) 2021, VRAI Labs and/or its affiliates. All rights reserved.
 *
 * This software is licensed under the Apache License, Version 2.0 (the
 * "License") as published by the Apache Software Foundation.
 *
 * You may not use this file except in compliance with the License. You may
 * obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
const {
    printPath,
    setupST,
    startST,
    createServerlessCacheForTesting,
    killAllST,
    cleanST,
    extractInfoFromResponse,
    setKeyValueInConfig,
} = require("./utils");
let assert = require("assert");
const express = require("express");
const request = require("supertest");
let { ProcessState, PROCESS_STATE } = require("../lib/build/processState");
let SuperTokens = require("../");
let Session = require("../recipe/session");
let { Querier } = require("../lib/build/querier");
const { default: NormalisedURLPath } = require("../lib/build/normalisedURLPath");
const { removeServerlessCache } = require("../lib/build/utils");

describe(`sessionExpress: ${printPath("[test/sessionExpress.test.js]")}`, function () {
    beforeEach(async function () {
        await killAllST();
        await setupST();
        await createServerlessCacheForTesting();
        await removeServerlessCache();
        ProcessState.getInstance().reset();
    });

    after(async function () {
        await killAllST();
        await cleanST();
    });

    // check if disableDefaultImplementation is true, the default refresh API does not work - you get a 404
    //Failure condition: if disableDefaultImplementation is false, the test will fail
    it("test that if disableDefaultImplementation is true the default refresh API does not work", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    sessionRefreshFeature: {
                        disableDefaultImplementation: true,
                    },
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });
        const app = express();
        app.use(SuperTokens.middleware());

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let res2 = await new Promise((resolve) =>
            request(app)
                .post("/auth/session/refresh")
                .set("Cookie", ["sRefreshToken=" + res.refreshToken, "sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .set("anti-csrf", res.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        assert(res2.status === 404);
    });

    it("test that if disableDefaultImplementation is true the default sign out API does not work", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    signOutFeature: {
                        disableDefaultImplementation: true,
                    },
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });
        const app = express();
        app.use(SuperTokens.middleware());

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let res2 = await new Promise((resolve) =>
            request(app)
                .post("/auth/signout")
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        assert(res2.status === 404);
    });

    //- check for token theft detection
    it("express token theft detection", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();
        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", async (req, res) => {
            await Session.getSession(req, res, true);
            res.status(200).send("");
        });

        app.post("/auth/session/refresh", async (req, res) => {
            try {
                await Session.refreshSession(req, res);
                res.status(200).send(JSON.stringify({ success: false }));
            } catch (err) {
                res.status(200).json({
                    success: err.type === Session.Error.TOKEN_THEFT_DETECTED,
                });
            }
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let res2 = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/auth/session/refresh")
                    .set("Cookie", [
                        "sRefreshToken=" + res.refreshToken,
                        "sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", res.antiCsrf)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", [
                    "sAccessToken=" + res2.accessToken + ";sIdRefreshToken=" + res2.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", res2.antiCsrf)
                .end((err, res) => {
                    resolve();
                })
        );

        let res3 = await new Promise((resolve) =>
            request(app)
                .post("/auth/session/refresh")
                .set("Cookie", ["sRefreshToken=" + res.refreshToken, "sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .set("anti-csrf", res.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(res3.body.success, true);

        let cookies = extractInfoFromResponse(res3);
        assert.deepEqual(cookies.antiCsrf, undefined);
        assert.deepEqual(cookies.accessToken, "");
        assert.deepEqual(cookies.refreshToken, "");
        assert.deepEqual(cookies.idRefreshTokenFromHeader, "remove");
        assert.deepEqual(cookies.idRefreshTokenFromCookie, "");
        assert.deepEqual(cookies.accessTokenExpiry, "Thu, 01 Jan 1970 00:00:00 GMT");
        assert.deepEqual(cookies.idRefreshTokenExpiry, "Thu, 01 Jan 1970 00:00:00 GMT");
        assert.deepEqual(cookies.refreshTokenExpiry, "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(cookies.accessTokenDomain === undefined);
        assert(cookies.refreshTokenDomain === undefined);
        assert(cookies.idRefreshTokenDomain === undefined);
    });

    //- check for token theft detection
    it("express token theft detection with auto refresh middleware", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();

        app.use(SuperTokens.middleware());

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", Session.verifySession(), async (req, res) => {
            res.status(200).send("");
        });

        app.use(SuperTokens.errorHandler());

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let res2 = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/auth/session/refresh")
                    .set("Cookie", [
                        "sRefreshToken=" + res.refreshToken,
                        "sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", res.antiCsrf)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", [
                    "sAccessToken=" + res2.accessToken + ";sIdRefreshToken=" + res2.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", res2.antiCsrf)
                .end((err, res) => {
                    resolve();
                })
        );

        let res3 = await new Promise((resolve) =>
            request(app)
                .post("/auth/session/refresh")
                .set("Cookie", ["sRefreshToken=" + res.refreshToken, "sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .set("anti-csrf", res.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert(res3.status === 401);
        assert.deepEqual(res3.text, '{"message":"token theft detected"}');

        let cookies = extractInfoFromResponse(res3);
        assert.deepEqual(cookies.antiCsrf, undefined);
        assert.deepEqual(cookies.accessToken, "");
        assert.deepEqual(cookies.refreshToken, "");
        assert.deepEqual(cookies.idRefreshTokenFromHeader, "remove");
        assert.deepEqual(cookies.idRefreshTokenFromCookie, "");
        assert.deepEqual(cookies.accessTokenExpiry, "Thu, 01 Jan 1970 00:00:00 GMT");
        assert.deepEqual(cookies.idRefreshTokenExpiry, "Thu, 01 Jan 1970 00:00:00 GMT");
        assert.deepEqual(cookies.refreshTokenExpiry, "Thu, 01 Jan 1970 00:00:00 GMT");
    });

    //check basic usage of session
    it("test basic usage of express sessions", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", async (req, res) => {
            await Session.getSession(req, res, true);
            res.status(200).send("");
        });
        app.post("/auth/session/refresh", async (req, res) => {
            await Session.refreshSession(req, res);
            res.status(200).send("");
        });
        app.post("/session/revoke", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            await session.revokeSession();
            res.status(200).send("");
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        assert(res.accessToken !== undefined);
        assert(res.antiCsrf !== undefined);
        assert(res.idRefreshTokenFromCookie !== undefined);
        assert(res.idRefreshTokenFromHeader !== undefined);
        assert(res.refreshToken !== undefined);

        await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .set("anti-csrf", res.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        let verifyState3 = await ProcessState.getInstance().waitForEvent(PROCESS_STATE.CALLING_SERVICE_IN_VERIFY, 1500);
        assert(verifyState3 === undefined);

        let res2 = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/auth/session/refresh")
                    .set("Cookie", [
                        "sRefreshToken=" + res.refreshToken,
                        "sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", res.antiCsrf)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        assert(res2.accessToken !== undefined);
        assert(res2.antiCsrf !== undefined);
        assert(res2.idRefreshTokenFromCookie !== undefined);
        assert(res2.idRefreshTokenFromHeader !== undefined);
        assert(res2.refreshToken !== undefined);

        let res3 = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/session/verify")
                    .set("Cookie", [
                        "sAccessToken=" + res2.accessToken + ";sIdRefreshToken=" + res2.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", res2.antiCsrf)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );
        let verifyState = await ProcessState.getInstance().waitForEvent(PROCESS_STATE.CALLING_SERVICE_IN_VERIFY);
        assert(verifyState !== undefined);
        assert(res3.accessToken !== undefined);

        ProcessState.getInstance().reset();

        await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", [
                    "sAccessToken=" + res3.accessToken + ";sIdRefreshToken=" + res3.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", res2.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        let verifyState2 = await ProcessState.getInstance().waitForEvent(PROCESS_STATE.CALLING_SERVICE_IN_VERIFY, 1000);
        assert(verifyState2 === undefined);

        let sessionRevokedResponse = await new Promise((resolve) =>
            request(app)
                .post("/session/revoke")
                .set("Cookie", [
                    "sAccessToken=" + res3.accessToken + ";sIdRefreshToken=" + res3.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", res2.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        let sessionRevokedResponseExtracted = extractInfoFromResponse(sessionRevokedResponse);
        assert(sessionRevokedResponseExtracted.accessTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.refreshTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.idRefreshTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.accessToken === "");
        assert(sessionRevokedResponseExtracted.refreshToken === "");
        assert(sessionRevokedResponseExtracted.idRefreshTokenFromCookie === "");
        assert(sessionRevokedResponseExtracted.idRefreshTokenFromHeader === "remove");
    });

    it("test signout API works", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });
        const app = express();
        app.use(SuperTokens.middleware());

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let sessionRevokedResponse = await new Promise((resolve) =>
            request(app)
                .post("/auth/signout")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .set("anti-csrf", res.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        let sessionRevokedResponseExtracted = extractInfoFromResponse(sessionRevokedResponse);
        assert(sessionRevokedResponseExtracted.accessTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.refreshTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.idRefreshTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.accessToken === "");
        assert(sessionRevokedResponseExtracted.refreshToken === "");
        assert(sessionRevokedResponseExtracted.idRefreshTokenFromCookie === "");
        assert(sessionRevokedResponseExtracted.idRefreshTokenFromHeader === "remove");
    });

    //check basic usage of session
    it("test basic usage of express sessions with auto refresh", async function () {
        await startST();

        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
                apiBasePath: "/",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();

        app.use(SuperTokens.middleware());

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", Session.verifySession(), async (req, res) => {
            res.status(200).send("");
        });

        app.post("/session/revoke", Session.verifySession(), async (req, res) => {
            let session = req.session;
            await session.revokeSession();
            res.status(200).send("");
        });

        app.use(SuperTokens.errorHandler());

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        assert(res.accessToken !== undefined);
        assert(res.antiCsrf !== undefined);
        assert(res.idRefreshTokenFromCookie !== undefined);
        assert(res.idRefreshTokenFromHeader !== undefined);
        assert(res.refreshToken !== undefined);

        await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .set("anti-csrf", res.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        let verifyState3 = await ProcessState.getInstance().waitForEvent(PROCESS_STATE.CALLING_SERVICE_IN_VERIFY, 1500);
        assert(verifyState3 === undefined);

        let res2 = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/session/refresh")
                    .set("Cookie", [
                        "sRefreshToken=" + res.refreshToken,
                        "sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", res.antiCsrf)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        assert(res2.accessToken !== undefined);
        assert(res2.antiCsrf !== undefined);
        assert(res2.idRefreshTokenFromCookie !== undefined);
        assert(res2.idRefreshTokenFromHeader !== undefined);
        assert(res2.refreshToken !== undefined);

        let res3 = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/session/verify")
                    .set("Cookie", [
                        "sAccessToken=" + res2.accessToken + ";sIdRefreshToken=" + res2.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", res2.antiCsrf)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );
        let verifyState = await ProcessState.getInstance().waitForEvent(PROCESS_STATE.CALLING_SERVICE_IN_VERIFY);
        assert(verifyState !== undefined);
        assert(res3.accessToken !== undefined);

        ProcessState.getInstance().reset();

        await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", [
                    "sAccessToken=" + res3.accessToken + ";sIdRefreshToken=" + res3.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", res2.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        let verifyState2 = await ProcessState.getInstance().waitForEvent(PROCESS_STATE.CALLING_SERVICE_IN_VERIFY, 1000);
        assert(verifyState2 === undefined);

        let sessionRevokedResponse = await new Promise((resolve) =>
            request(app)
                .post("/session/revoke")
                .set("Cookie", [
                    "sAccessToken=" + res3.accessToken + ";sIdRefreshToken=" + res3.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", res2.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        let sessionRevokedResponseExtracted = extractInfoFromResponse(sessionRevokedResponse);
        assert(sessionRevokedResponseExtracted.accessTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.refreshTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.idRefreshTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.accessToken === "");
        assert(sessionRevokedResponseExtracted.refreshToken === "");
        assert(sessionRevokedResponseExtracted.idRefreshTokenFromCookie === "");
        assert(sessionRevokedResponseExtracted.idRefreshTokenFromHeader === "remove");
    });

    //check session verify for with / without anti-csrf present
    it("test express session verify with anti-csrf present", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();
        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "id1", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", async (req, res) => {
            let sessionResponse = await Session.getSession(req, res, true);
            res.status(200).json({ userId: sessionResponse.userId });
        });

        app.post("/session/verifyAntiCsrfFalse", async (req, res) => {
            let sessionResponse = await Session.getSession(req, res, false);
            res.status(200).json({ userId: sessionResponse.userId });
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let res2 = await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .set("anti-csrf", res.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(res2.body.userId, "id1");

        let res3 = await new Promise((resolve) =>
            request(app)
                .post("/session/verifyAntiCsrfFalse")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .set("anti-csrf", res.antiCsrf)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(res3.body.userId, "id1");
    });

    // check session verify for with / without anti-csrf present
    it("test session verify without anti-csrf present express", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "id1", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", async (req, res) => {
            try {
                let sessionResponse = await Session.getSession(req, res, true);
                res.status(200).json({ success: false });
            } catch (err) {
                res.status(200).json({
                    success: err.type === Session.Error.TRY_REFRESH_TOKEN,
                });
            }
        });

        app.post("/session/verifyAntiCsrfFalse", async (req, res) => {
            let sessionResponse = await Session.getSession(req, res, false);
            res.status(200).json({ userId: sessionResponse.userId });
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let response2 = await new Promise((resolve) =>
            request(app)
                .post("/session/verifyAntiCsrfFalse")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(response2.body.userId, "id1");

        let response = await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(response.body.success, true);
    });

    //check revoking session(s)**
    it("test revoking express sessions", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });
        const app = express();
        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });
        app.post("/usercreate", async (req, res) => {
            await Session.createNewSession(res, "someUniqueUserId", {}, {});
            res.status(200).send("");
        });
        app.post("/session/revoke", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            await session.revokeSession();
            res.status(200).send("");
        });

        app.post("/session/revokeUserid", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            await Session.revokeAllSessionsForUser(session.getUserId());
            res.status("200").send("");
        });

        //create an api call get sesssions from a userid "id1" that returns all the sessions for that userid
        app.post("/session/getSessionsWithUserId1", async (req, res) => {
            let sessionHandles = await Session.getAllSessionHandlesForUser("someUniqueUserId");
            res.status(200).json(sessionHandles);
        });

        let response = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );
        let sessionRevokedResponse = await new Promise((resolve) =>
            request(app)
                .post("/session/revoke")
                .set("Cookie", [
                    "sAccessToken=" + response.accessToken + ";sIdRefreshToken=" + response.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        let sessionRevokedResponseExtracted = extractInfoFromResponse(sessionRevokedResponse);
        assert(sessionRevokedResponseExtracted.accessTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.refreshTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.idRefreshTokenExpiry === "Thu, 01 Jan 1970 00:00:00 GMT");
        assert(sessionRevokedResponseExtracted.accessToken === "");
        assert(sessionRevokedResponseExtracted.refreshToken === "");
        assert(sessionRevokedResponseExtracted.idRefreshTokenFromCookie === "");
        assert(sessionRevokedResponseExtracted.idRefreshTokenFromHeader === "remove");

        await new Promise((resolve) =>
            request(app)
                .post("/usercreate")
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        let userCreateResponse = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/usercreate")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        await new Promise((resolve) =>
            request(app)
                .post("/session/revokeUserid")
                .set("Cookie", [
                    "sAccessToken=" +
                        userCreateResponse.accessToken +
                        ";sIdRefreshToken=" +
                        userCreateResponse.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", userCreateResponse.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        let sessionHandleResponse = await new Promise((resolve) =>
            request(app)
                .post("/session/getSessionsWithUserId1")
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert(sessionHandleResponse.body.length === 0);
    });

    //check manipulating session data
    it("test manipulating session data with express", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();
        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });
        app.post("/updateSessionData", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            await session.updateSessionData({ key: "value" });
            res.status(200).send("");
        });
        app.post("/getSessionData", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            let sessionData = await session.getSessionData();
            res.status(200).json(sessionData);
        });

        app.post("/updateSessionData2", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            await session.updateSessionData(null);
            res.status(200).send("");
        });

        app.post("/updateSessionDataInvalidSessionHandle", async (req, res) => {
            try {
                await Session.updateSessionData("InvalidHandle", { key: "value3" });
                res.status(200).json({ success: false });
            } catch (err) {
                res.status(200).json({
                    success: err.type === Session.Error.UNAUTHORISED,
                });
            }
        });

        //create a new session
        let response = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        //call the updateSessionData api to add session data
        await new Promise((resolve) =>
            request(app)
                .post("/updateSessionData")
                .set("Cookie", [
                    "sAccessToken=" + response.accessToken + ";sIdRefreshToken=" + response.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        //call the getSessionData api to get session data
        let response2 = await new Promise((resolve) =>
            request(app)
                .post("/getSessionData")
                .set("Cookie", [
                    "sAccessToken=" + response.accessToken + ";sIdRefreshToken=" + response.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        //check that the session data returned is valid
        assert.deepEqual(response2.body.key, "value");

        // change the value of the inserted session data
        await new Promise((resolve) =>
            request(app)
                .post("/updateSessionData2")
                .set("Cookie", [
                    "sAccessToken=" + response.accessToken + ";sIdRefreshToken=" + response.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        //retrieve the changed session data
        response2 = await new Promise((resolve) =>
            request(app)
                .post("/getSessionData")
                .set("Cookie", [
                    "sAccessToken=" + response.accessToken + ";sIdRefreshToken=" + response.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        //check the value of the retrieved
        assert.deepStrictEqual(response2.body, {});

        //invalid session handle when updating the session data
        let invalidSessionResponse = await new Promise((resolve) =>
            request(app)
                .post("/updateSessionDataInvalidSessionHandle")
                .set("Cookie", [
                    "sAccessToken=" + response.accessToken + ";sIdRefreshToken=" + response.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(invalidSessionResponse.body.success, true);
    });

    //check manipulating jwt payload
    it("test manipulating jwt payload with express", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });
        const app = express();
        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "user1", {}, {});
            res.status(200).send("");
        });
        app.post("/updateJWTPayload", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            let accessTokenBefore = session.accessToken;
            await session.updateJWTPayload({ key: "value" });
            let accessTokenAfter = session.accessToken;
            let statusCode = accessTokenBefore !== accessTokenAfter && typeof accessTokenAfter === "string" ? 200 : 500;
            res.status(statusCode).send("");
        });
        app.post("/auth/session/refresh", async (req, res) => {
            await Session.refreshSession(req, res);
            res.status(200).send("");
        });
        app.post("/getJWTPayload", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            let jwtPayload = session.getJWTPayload();
            res.status(200).json(jwtPayload);
        });

        app.post("/updateJWTPayload2", async (req, res) => {
            let session = await Session.getSession(req, res, true);
            await session.updateJWTPayload(null);
            res.status(200).send("");
        });

        app.post("/updateJWTPayloadInvalidSessionHandle", async (req, res) => {
            try {
                await Session.updateJWTPayload("InvalidHandle", { key: "value3" });
            } catch (err) {
                res.status(200).json({
                    success: err.type === Session.Error.UNAUTHORISED,
                });
            }
        });

        //create a new session
        let response = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let frontendInfo = JSON.parse(new Buffer.from(response.frontToken, "base64").toString());
        assert(frontendInfo.uid === "user1");
        assert.deepEqual(frontendInfo.up, {});

        //call the updateJWTPayload api to add jwt payload
        let updatedResponse = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/updateJWTPayload")
                    .set("Cookie", [
                        "sAccessToken=" +
                            response.accessToken +
                            ";sIdRefreshToken=" +
                            response.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", response.antiCsrf)
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        frontendInfo = JSON.parse(new Buffer.from(updatedResponse.frontToken, "base64").toString());
        assert(frontendInfo.uid === "user1");
        assert.deepEqual(frontendInfo.up, { key: "value" });

        //call the getJWTPayload api to get jwt payload
        let response2 = await new Promise((resolve) =>
            request(app)
                .post("/getJWTPayload")
                .set("Cookie", [
                    "sAccessToken=" +
                        updatedResponse.accessToken +
                        ";sIdRefreshToken=" +
                        response.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        //check that the jwt payload returned is valid
        assert.deepEqual(response2.body.key, "value");

        // refresh session
        response2 = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/auth/session/refresh")
                    .set("Cookie", [
                        "sRefreshToken=" +
                            response.refreshToken +
                            ";sIdRefreshToken=" +
                            response.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", response.antiCsrf)
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        frontendInfo = JSON.parse(new Buffer.from(response2.frontToken, "base64").toString());
        assert(frontendInfo.uid === "user1");
        assert.deepEqual(frontendInfo.up, { key: "value" });

        // change the value of the inserted jwt payload
        let updatedResponse2 = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/updateJWTPayload2")
                    .set("Cookie", [
                        "sAccessToken=" +
                            response2.accessToken +
                            ";sIdRefreshToken=" +
                            response2.idRefreshTokenFromCookie,
                    ])
                    .set("anti-csrf", response2.antiCsrf)
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        frontendInfo = JSON.parse(new Buffer.from(updatedResponse2.frontToken, "base64").toString());
        assert(frontendInfo.uid === "user1");
        assert.deepStrictEqual(frontendInfo.up, {});

        //retrieve the changed jwt payload
        response2 = await new Promise((resolve) =>
            request(app)
                .post("/getJWTPayload")
                .set("Cookie", [
                    "sAccessToken=" +
                        updatedResponse2.accessToken +
                        ";sIdRefreshToken=" +
                        response2.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response2.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        //check the value of the retrieved
        assert.deepStrictEqual(response2.body, {});
        //invalid session handle when updating the jwt payload
        let invalidSessionResponse = await new Promise((resolve) =>
            request(app)
                .post("/updateJWTPayloadInvalidSessionHandle")
                .set("Cookie", [
                    "sAccessToken=" +
                        updatedResponse2.accessToken +
                        ";sIdRefreshToken=" +
                        response.idRefreshTokenFromCookie,
                ])
                .set("anti-csrf", response.antiCsrf)
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(invalidSessionResponse.body.success, true);
    });

    // test with existing header params being there and that the lib appends to those and not overrides those
    it("test that express appends to existing header params and does not override", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });
        const app = express();
        app.post("/create", async (req, res) => {
            res.header("testHeader", "testValue");
            res.header("Access-Control-Expose-Headers", "customValue");
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        //create a new session

        let response = await new Promise((resolve) =>
            request(app)
                .post("/create")
                .expect(200)
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(response.headers.testheader, "testValue");
        assert.deepEqual(
            response.headers["access-control-expose-headers"],
            "customValue, front-token, id-refresh-token, anti-csrf"
        );

        //normal session headers
        let extractInfo = extractInfoFromResponse(response);
        assert(extractInfo.accessToken !== undefined);
        assert(extractInfo.refreshToken != undefined);
        assert(extractInfo.idRefreshTokenFromCookie !== undefined);
        assert(extractInfo.idRefreshTokenFromHeader !== undefined);
        assert(extractInfo.antiCsrf !== undefined);
    });

    //if anti-csrf is disabled from ST core, check that not having that in input to verify session is fine**
    it("test that when anti-csrf is disabled from from ST core, not having to input in verify session is fine in express", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "NONE",
                }),
            ],
        });

        const app = express();
        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "id1", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", async (req, res) => {
            let sessionResponse = await Session.getSession(req, res, true);
            res.status(200).json({ userId: sessionResponse.userId });
        });
        app.post("/session/verifyAntiCsrfFalse", async (req, res) => {
            let sessionResponse = await Session.getSession(req, res, false);
            res.status(200).json({ userId: sessionResponse.userId });
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        let res2 = await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(res2.body.userId, "id1");

        let res3 = await new Promise((resolve) =>
            request(app)
                .post("/session/verifyAntiCsrfFalse")
                .set("Cookie", ["sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie])
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );
        assert.deepEqual(res3.body.userId, "id1");
    });

    it("test that getSession does not clear cookies if a session does not exist in the first place", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();

        app.post("/session/verify", async (req, res) => {
            try {
                await Session.getSession(req, res, true);
            } catch (err) {
                if (err.type === Session.Error.UNAUTHORISED) {
                    res.status(200).json({ success: true });
                    return;
                }
            }
            res.status(200).json({ success: false });
        });

        let res = await new Promise((resolve) =>
            request(app)
                .post("/session/verify")
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        assert.deepEqual(res.body.success, true);

        let cookies = extractInfoFromResponse(res);
        assert.deepEqual(cookies.antiCsrf, undefined);
        assert.deepEqual(cookies.accessToken, undefined);
        assert.deepEqual(cookies.refreshToken, undefined);
        assert.deepEqual(cookies.idRefreshTokenFromHeader, undefined);
        assert.deepEqual(cookies.idRefreshTokenFromCookie, undefined);
        assert.deepEqual(cookies.accessTokenExpiry, undefined);
        assert.deepEqual(cookies.idRefreshTokenExpiry, undefined);
        assert.deepEqual(cookies.refreshTokenExpiry, undefined);
    });

    it("test that refreshSession does not clear cookies if a session does not exist in the first place", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_TOKEN",
                }),
            ],
        });

        const app = express();

        app.post("/auth/session/refresh", async (req, res) => {
            try {
                await Session.refreshSession(req, res);
            } catch (err) {
                if (err.type === Session.Error.UNAUTHORISED) {
                    res.status(200).json({ success: true });
                    return;
                }
            }
            res.status(200).json({ success: false });
        });

        let res = await new Promise((resolve) =>
            request(app)
                .post("/auth/session/refresh")
                .end((err, res) => {
                    if (err) {
                        resolve(undefined);
                    } else {
                        resolve(res);
                    }
                })
        );

        assert.deepEqual(res.body.success, true);

        let cookies = extractInfoFromResponse(res);
        assert.deepEqual(cookies.antiCsrf, undefined);
        assert.deepEqual(cookies.accessToken, undefined);
        assert.deepEqual(cookies.refreshToken, undefined);
        assert.deepEqual(cookies.idRefreshTokenFromHeader, undefined);
        assert.deepEqual(cookies.idRefreshTokenFromCookie, undefined);
        assert.deepEqual(cookies.accessTokenExpiry, undefined);
        assert.deepEqual(cookies.idRefreshTokenExpiry, undefined);
        assert.deepEqual(cookies.refreshTokenExpiry, undefined);
    });

    it("test that when anti-csrf is enabled with custom header, and we don't provide that in verifySession, we get try refresh token", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_CUSTOM_HEADER",
                }),
            ],
        });

        const app = express();
        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "id1", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", Session.verifySession(), async (req, res) => {
            let sessionResponse = req.session;
            res.status(200).json({ userId: sessionResponse.userId });
        });
        app.post("/session/verifyAntiCsrfFalse", Session.verifySession(false), async (req, res) => {
            let sessionResponse = req.session;
            res.status(200).json({ userId: sessionResponse.userId });
        });

        app.use(SuperTokens.errorHandler());

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        {
            let res2 = await new Promise((resolve) =>
                request(app)
                    .post("/session/verify")
                    .set("Cookie", [
                        "sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            );
            assert.deepStrictEqual(res2.status, 401);
            assert.deepStrictEqual(res2.text, '{"message":"try refresh token"}');

            let res3 = await new Promise((resolve) =>
                request(app)
                    .post("/session/verify")
                    .set("Cookie", [
                        "sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .set("rid", "session")
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            );
            assert.deepStrictEqual(res3.body.userId, "id1");
        }

        {
            let res2 = await new Promise((resolve) =>
                request(app)
                    .post("/session/verifyAntiCsrfFalse")
                    .set("Cookie", [
                        "sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            );
            assert.deepStrictEqual(res2.body.userId, "id1");

            let res3 = await new Promise((resolve) =>
                request(app)
                    .post("/session/verifyAntiCsrfFalse")
                    .set("Cookie", [
                        "sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .set("rid", "session")
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            );
            assert.deepStrictEqual(res3.body.userId, "id1");
        }
    });

    it("test resfresh API when using CUSTOM HEADER anti-csrf", async function () {
        await startST();
        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_CUSTOM_HEADER",
                }),
            ],
        });
        const app = express();
        app.use(SuperTokens.middleware());

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "", {}, {});
            res.status(200).send("");
        });

        app.use(SuperTokens.errorHandler());

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        {
            let res2 = await new Promise((resolve) =>
                request(app)
                    .post("/auth/session/refresh")
                    .set("Cookie", [
                        "sRefreshToken=" + res.refreshToken,
                        "sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            );

            assert.deepStrictEqual(res2.status, 401);
            assert.deepStrictEqual(res2.text, '{"message":"unauthorised"}');
        }

        {
            let res2 = await new Promise((resolve) =>
                request(app)
                    .post("/auth/session/refresh")
                    .set("Cookie", [
                        "sRefreshToken=" + res.refreshToken,
                        "sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .set("rid", "session")
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            );

            assert.deepStrictEqual(res2.status, 200);
        }
    });

    it("test that init can be called post route and middleware declaration", async function () {
        await startST();

        const app = express();

        app.use(SuperTokens.middleware());

        app.post("/create", async (req, res) => {
            await Session.createNewSession(res, "id1", {}, {});
            res.status(200).send("");
        });

        app.post("/session/verify", Session.verifySession(), async (req, res) => {
            let sessionResponse = req.session;
            res.status(200).json({ userId: sessionResponse.userId });
        });
        app.post("/session/verifyAntiCsrfFalse", Session.verifySession(false), async (req, res) => {
            let sessionResponse = req.session;
            res.status(200).json({ userId: sessionResponse.userId });
        });

        app.use(SuperTokens.errorHandler());

        SuperTokens.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [
                Session.init({
                    antiCsrf: "VIA_CUSTOM_HEADER",
                }),
            ],
        });

        let res = extractInfoFromResponse(
            await new Promise((resolve) =>
                request(app)
                    .post("/create")
                    .expect(200)
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            )
        );

        {
            let res2 = await new Promise((resolve) =>
                request(app)
                    .post("/session/verify")
                    .set("Cookie", [
                        "sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            );
            assert.deepStrictEqual(res2.status, 401);
            assert.deepStrictEqual(res2.text, '{"message":"try refresh token"}');

            let res3 = await new Promise((resolve) =>
                request(app)
                    .post("/session/verify")
                    .set("Cookie", [
                        "sAccessToken=" + res.accessToken + ";sIdRefreshToken=" + res.idRefreshTokenFromCookie,
                    ])
                    .set("rid", "session")
                    .end((err, res) => {
                        if (err) {
                            resolve(undefined);
                        } else {
                            resolve(res);
                        }
                    })
            );
            assert.deepStrictEqual(res3.body.userId, "id1");
        }
    });
});

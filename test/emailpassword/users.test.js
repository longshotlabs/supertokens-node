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
const { printPath, setupST, startST, stopST, killAllST, cleanST, signUPRequest } = require("../utils");
const { getUserCount, getUsersNewestFirst, getUsersOldestFirst } = require("../../lib/build/recipe/emailpassword");
let assert = require("assert");
let { ProcessState } = require("../../lib/build/processState");
let STExpress = require("../../");
let Session = require("../../recipe/session");
let EmailPassword = require("../../recipe/emailpassword");

describe(`usersTest: ${printPath("[test/emailpassword/users.test.js]")}`, function () {
    beforeEach(async function () {
        await killAllST();
        await setupST();
        ProcessState.getInstance().reset();
    });

    after(async function () {
        await killAllST();
        await cleanST();
    });

    it("test getUsersOldestFirst", async function () {
        await startST();
        STExpress.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [EmailPassword.init(), Session.init()],
        });

        const express = require("express");
        const app = express();

        app.use(STExpress.middleware());

        app.use(STExpress.errorHandler());

        await signUPRequest(app, "test@gmail.com", "testPass123");
        await signUPRequest(app, "test1@gmail.com", "testPass123");
        await signUPRequest(app, "test2@gmail.com", "testPass123");
        await signUPRequest(app, "test3@gmail.com", "testPass123");
        await signUPRequest(app, "test4@gmail.com", "testPass123");

        let users = await getUsersOldestFirst();
        assert.strictEqual(users.users.length, 5);
        assert.strictEqual(users.nextPaginationToken, undefined);

        users = await getUsersOldestFirst(1);
        assert.strictEqual(users.users.length, 1);
        assert.strictEqual(users.users[0].email, "test@gmail.com");
        assert.strictEqual(typeof users.nextPaginationToken, "string");

        users = await getUsersOldestFirst(1, users.nextPaginationToken);
        assert.strictEqual(users.users.length, 1);
        assert.strictEqual(users.users[0].email, "test1@gmail.com");
        assert.strictEqual(typeof users.nextPaginationToken, "string");

        users = await getUsersOldestFirst(5, users.nextPaginationToken);
        assert.strictEqual(users.users.length, 3);
        assert.strictEqual(users.nextPaginationToken, undefined);

        try {
            await getUsersOldestFirst(10, "invalid-pagination-token");
            assert(false);
        } catch (err) {
            assert(true);
        }

        try {
            await getUsersOldestFirst(-1);
            assert(false);
        } catch (err) {
            assert(true);
        }
    });

    it("test getUsersNewestFirst", async function () {
        await startST();
        STExpress.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [EmailPassword.init(), Session.init()],
        });

        const express = require("express");
        const app = express();

        app.use(STExpress.middleware());

        app.use(STExpress.errorHandler());

        await signUPRequest(app, "test@gmail.com", "testPass123");
        await signUPRequest(app, "test1@gmail.com", "testPass123");
        await signUPRequest(app, "test2@gmail.com", "testPass123");
        await signUPRequest(app, "test3@gmail.com", "testPass123");
        await signUPRequest(app, "test4@gmail.com", "testPass123");

        let users = await getUsersNewestFirst();
        assert.strictEqual(users.users.length, 5);
        assert.strictEqual(users.nextPaginationToken, undefined);

        users = await getUsersNewestFirst(1);
        assert.strictEqual(users.users.length, 1);
        assert.strictEqual(users.users[0].email, "test4@gmail.com");
        assert.strictEqual(typeof users.nextPaginationToken, "string");

        users = await getUsersNewestFirst(1, users.nextPaginationToken);
        assert.strictEqual(users.users.length, 1);
        assert.strictEqual(users.users[0].email, "test3@gmail.com");
        assert.strictEqual(typeof users.nextPaginationToken, "string");

        users = await getUsersNewestFirst(5, users.nextPaginationToken);
        assert.strictEqual(users.users.length, 3);
        assert.strictEqual(users.nextPaginationToken, undefined);

        try {
            await getUsersNewestFirst(10, "invalid-pagination-token");
            assert(false);
        } catch (err) {
            assert(true);
        }

        try {
            await getUsersNewestFirst(-1);
            assert(false);
        } catch (err) {
            assert(true);
        }
    });

    it("test getUserCount", async function () {
        await startST();
        STExpress.init({
            supertokens: {
                connectionURI: "http://localhost:8080",
            },
            appInfo: {
                apiDomain: "api.supertokens.io",
                appName: "SuperTokens",
                websiteDomain: "supertokens.io",
            },
            recipeList: [EmailPassword.init(), Session.init()],
        });

        let userCount = await getUserCount();
        assert.strictEqual(userCount, 0);

        const express = require("express");
        const app = express();

        app.use(STExpress.middleware());

        app.use(STExpress.errorHandler());

        await signUPRequest(app, "test@gmail.com", "testPass123");
        userCount = await getUserCount();
        assert.strictEqual(userCount, 1);

        await signUPRequest(app, "test1@gmail.com", "testPass123");
        await signUPRequest(app, "test2@gmail.com", "testPass123");
        await signUPRequest(app, "test3@gmail.com", "testPass123");
        await signUPRequest(app, "test4@gmail.com", "testPass123");

        userCount = await getUserCount();
        assert.strictEqual(userCount, 5);
    });
});
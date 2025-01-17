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
const { exec } = require("child_process");
const nock = require("nock");
const request = require("supertest");
let fs = require("fs");
let SuperTokens = require("../lib/build/supertokens").default;
let SessionRecipe = require("../lib/build/recipe/session/sessionRecipe").default;
let ThirPartyRecipe = require("../lib/build/recipe/thirdparty/recipe").default;
let ThirdPartyEmailPasswordRecipe = require("../lib/build/recipe/thirdpartyemailpassword/recipe").default;
let EmailPasswordRecipe = require("../lib/build/recipe/emailpassword/recipe").default;
let FaunaDBSessionRecipe = require("../lib/build/recipe/session/faunadb/sessionRecipe").default;
let { ProcessState } = require("../lib/build/processState");

module.exports.printPath = function (path) {
    return `${createFormat([consoleOptions.yellow, consoleOptions.italic, consoleOptions.dim])}${path}${createFormat([
        consoleOptions.default,
    ])}`;
};

module.exports.executeCommand = async function (cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
};

module.exports.setKeyValueInConfig = async function (key, value) {
    return new Promise((resolve, reject) => {
        let installationPath = process.env.INSTALL_PATH;
        fs.readFile(installationPath + "/config.yaml", "utf8", function (err, data) {
            if (err) {
                reject(err);
                return;
            }
            let oldStr = new RegExp("((#\\s)?)" + key + "(:|((:\\s).+))\n");
            let newStr = key + ": " + value + "\n";
            let result = data.replace(oldStr, newStr);
            fs.writeFile(installationPath + "/config.yaml", result, "utf8", function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    });
};

module.exports.extractInfoFromResponse = function (res) {
    let antiCsrf = res.headers["anti-csrf"];
    let idRefreshTokenFromHeader = res.headers["id-refresh-token"];
    let accessToken = undefined;
    let refreshToken = undefined;
    let idRefreshTokenFromCookie = undefined;
    let accessTokenExpiry = undefined;
    let refreshTokenExpiry = undefined;
    let idRefreshTokenExpiry = undefined;
    let accessTokenDomain = undefined;
    let refreshTokenDomain = undefined;
    let idRefreshTokenDomain = undefined;
    let accessTokenHttpOnly = false;
    let idRefreshTokenHttpOnly = false;
    let refreshTokenHttpOnly = false;
    let frontToken = res.headers["front-token"];
    let cookies = res.headers["set-cookie"];
    cookies = cookies === undefined ? [] : cookies;
    cookies.forEach((i) => {
        if (i.split(";")[0].split("=")[0] === "sAccessToken") {
            accessToken = i.split(";")[0].split("=")[1];
            if (i.split(";")[2].includes("Expires=")) {
                accessTokenExpiry = i.split(";")[2].split("=")[1];
            } else {
                accessTokenExpiry = i.split(";")[3].split("=")[1];
            }
            if (i.split(";")[1].includes("Domain=")) {
                accessTokenDomain = i.split(";")[1].split("=")[1];
            }
            accessTokenHttpOnly = i.split(";").findIndex((j) => j.includes("HttpOnly")) !== -1;
        } else if (i.split(";")[0].split("=")[0] === "sRefreshToken") {
            refreshToken = i.split(";")[0].split("=")[1];
            if (i.split(";")[2].includes("Expires=")) {
                refreshTokenExpiry = i.split(";")[2].split("=")[1];
            } else {
                refreshTokenExpiry = i.split(";")[3].split("=")[1];
            }
            if (i.split(";")[1].includes("Domain=")) {
                refreshTokenDomain = i.split(";")[1].split("=")[1];
            }
            refreshTokenHttpOnly = i.split(";").findIndex((j) => j.includes("HttpOnly")) !== -1;
        } else {
            idRefreshTokenFromCookie = i.split(";")[0].split("=")[1];
            if (i.split(";")[2].includes("Expires=")) {
                idRefreshTokenExpiry = i.split(";")[2].split("=")[1];
            } else {
                idRefreshTokenExpiry = i.split(";")[3].split("=")[1];
            }
            if (i.split(";")[1].includes("Domain=")) {
                idRefreshTokenDomain = i.split(";")[1].split("=")[1];
            }
            idRefreshTokenHttpOnly = i.split(";").findIndex((j) => j.includes("HttpOnly")) !== -1;
        }
    });
    return {
        antiCsrf,
        accessToken,
        refreshToken,
        idRefreshTokenFromHeader,
        idRefreshTokenFromCookie,
        accessTokenExpiry,
        refreshTokenExpiry,
        idRefreshTokenExpiry,
        accessTokenDomain,
        refreshTokenDomain,
        idRefreshTokenDomain,
        frontToken,
        accessTokenHttpOnly,
        refreshTokenHttpOnly,
        idRefreshTokenHttpOnly,
    };
};

module.exports.setupST = async function () {
    let installationPath = process.env.INSTALL_PATH;
    try {
        await module.exports.executeCommand("cd " + installationPath + " && cp temp/licenseKey ./licenseKey");
    } catch (ignore) {}
    await module.exports.executeCommand("cd " + installationPath + " && cp temp/config.yaml ./config.yaml");
};

module.exports.cleanST = async function () {
    let installationPath = process.env.INSTALL_PATH;
    try {
        await module.exports.executeCommand("cd " + installationPath + " && rm licenseKey");
    } catch (ignore) {}
    await module.exports.executeCommand("cd " + installationPath + " && rm config.yaml");
    await module.exports.executeCommand("cd " + installationPath + " && rm -rf .webserver-temp-*");
    await module.exports.executeCommand("cd " + installationPath + " && rm -rf .started");
};

module.exports.stopST = async function (pid) {
    let pidsBefore = await getListOfPids();
    if (pidsBefore.length === 0) {
        return;
    }
    await module.exports.executeCommand("kill " + pid);
    let startTime = Date.now();
    while (Date.now() - startTime < 10000) {
        let pidsAfter = await getListOfPids();
        if (pidsAfter.includes(pid)) {
            await new Promise((r) => setTimeout(r, 100));
            continue;
        } else {
            return;
        }
    }
    throw new Error("error while stopping ST with PID: " + pid);
};

module.exports.resetAll = function () {
    SuperTokens.reset();
    SessionRecipe.reset();
    ThirdPartyEmailPasswordRecipe.reset();
    EmailPasswordRecipe.reset();
    FaunaDBSessionRecipe.reset();
    ThirPartyRecipe.reset();
    ProcessState.getInstance().reset();
};

module.exports.killAllST = async function () {
    let pids = await getListOfPids();
    for (let i = 0; i < pids.length; i++) {
        await module.exports.stopST(pids[i]);
    }
    module.exports.resetAll();
    nock.cleanAll();
};

module.exports.startST = async function (host = "localhost", port = 8080) {
    return new Promise(async (resolve, reject) => {
        let installationPath = process.env.INSTALL_PATH;
        let pidsBefore = await getListOfPids();
        let returned = false;
        module.exports
            .executeCommand(
                "cd " +
                    installationPath +
                    ` && java -Djava.security.egd=file:/dev/urandom -classpath "./core/*:./plugin-interface/*" io.supertokens.Main ./ DEV host=` +
                    host +
                    " port=" +
                    port
            )
            .catch((err) => {
                if (!returned) {
                    returned = true;
                    reject(err);
                }
            });
        let startTime = Date.now();
        while (Date.now() - startTime < 30000) {
            let pidsAfter = await getListOfPids();
            if (pidsAfter.length <= pidsBefore.length) {
                await new Promise((r) => setTimeout(r, 100));
                continue;
            }
            let nonIntersection = pidsAfter.filter((x) => !pidsBefore.includes(x));
            if (nonIntersection.length !== 1) {
                if (!returned) {
                    returned = true;
                    reject("something went wrong while starting ST");
                }
            } else {
                if (!returned) {
                    returned = true;
                    resolve(nonIntersection[0]);
                }
            }
        }
        if (!returned) {
            returned = true;
            reject("could not start ST process");
        }
    });
};

async function getListOfPids() {
    let installationPath = process.env.INSTALL_PATH;
    try {
        (await module.exports.executeCommand("cd " + installationPath + " && ls .started/")).stdout;
    } catch (err) {
        return [];
    }
    let currList = (await module.exports.executeCommand("cd " + installationPath + " && ls .started/")).stdout;
    currList = currList.split("\n");
    let result = [];
    for (let i = 0; i < currList.length; i++) {
        let item = currList[i];
        if (item === "") {
            continue;
        }
        try {
            let pid = (await module.exports.executeCommand("cd " + installationPath + " && cat .started/" + item))
                .stdout;
            result.push(pid);
        } catch (err) {}
    }
    return result;
}

function createFormat(options) {
    if (options.length === 0) {
        return ``;
    }
    let format = `\x1b[`;
    for (let i = 0; i < options.length; i++) {
        format += options[i];
        if (i !== options.length - 1) {
            format += `;`;
        }
    }
    format += `m`;
    return format;
}

const consoleOptions = {
    default: 0,
    bold: 1,
    dim: 2,
    italic: 3,
    underline: 4,
    blink: 5,
    white: 29,
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    purple: 35,
    cyan: 36,
};

module.exports.constants = {
    AUTH0_DOMAIN: "dev-3myi6b3e.us.auth0.com",
    AUTH0_CLIENT_ID: "wQwadNYL58PoXDTIEiLeBmCe89BnMfiv",
    AUTH0_CLIENT_SECRET: "46n7WEAScmrHXukA_w6v1C8uYlVXPvAqEwu5eAyJRD5Wu951BHhiuE_0cQpW5GiV",
    TEST_ID_TOKEN:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
};

module.exports.signUPRequest = async function (app, email, password) {
    return new Promise(function (resolve) {
        request(app)
            .post("/auth/signup")
            .send({
                formFields: [
                    {
                        id: "password",
                        value: password,
                    },
                    {
                        id: "email",
                        value: email,
                    },
                ],
            })
            .end((err, res) => {
                if (err) {
                    resolve(undefined);
                } else {
                    resolve(res);
                }
            });
    });
};

module.exports.signInUPCustomRequest = async function (app, email, id) {
    nock("https://test.com").post("/oauth/token").reply(200, {
        id,
        email,
    });
    return new Promise(function (resolve) {
        request(app)
            .post("/auth/signinup")
            .send({
                thirdPartyId: "custom",
                code: "abcdefghj",
                redirectURI: "http://127.0.0.1/callback",
            })
            .end((err, res) => {
                if (err) {
                    resolve(undefined);
                } else {
                    resolve(res);
                }
            });
    });
};

module.exports.emailVerifyTokenRequest = async function (app, accessToken, idRefreshTokenFromCookie, antiCsrf, userId) {
    let result = await new Promise(function (resolve) {
        request(app)
            .post("/auth/user/email/verify/token")
            .set("Cookie", ["sAccessToken=" + accessToken + ";sIdRefreshToken=" + idRefreshTokenFromCookie])
            .set("anti-csrf", antiCsrf)
            .send({
                userId,
            })
            .end((err, res) => {
                if (err) {
                    resolve(undefined);
                } else {
                    resolve(res);
                }
            });
    });

    // wait for the callback to be called...
    await new Promise((res) => setTimeout(res, 500));

    return result;
};

module.exports.createServerlessCacheForTesting = async function () {
    await new Promise((resolve, reject) => {
        fs.mkdir(process.env.SERVERLESS_CACHE_BASE_FILE_PATH, (err) => {
            if (err !== undefined && err !== null) {
                if (err.message.includes("EEXIST")) {
                    return resolve();
                }
                return reject(err);
            }
            resolve();
        });
    });
};

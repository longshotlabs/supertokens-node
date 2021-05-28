"use strict";
var __awaiter =
    (this && this.__awaiter) ||
    function (thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function (resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator["throw"](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
            }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };
Object.defineProperty(exports, "__esModule", { value: true });
const session_1 = require("../../session");
const url_1 = require("url");
const axios = require("axios");
const qs = require("querystring");
class APIImplementation {
    constructor() {
        this.authorisationUrlGET = (provider, options) =>
            __awaiter(this, void 0, void 0, function* () {
                let providerInfo = yield provider.get(undefined, undefined);
                const params = Object.entries(providerInfo.authorisationRedirect.params).reduce(
                    (acc, [key, value]) =>
                        Object.assign(Object.assign({}, acc), {
                            [key]: typeof value === "function" ? value(options.req) : value,
                        }),
                    {}
                );
                let paramsString = new url_1.URLSearchParams(params).toString();
                let url = `${providerInfo.authorisationRedirect.url}?${paramsString}`;
                return {
                    status: "OK",
                    url,
                };
            });
        this.signInUpPOST = (provider, code, redirectURI, options) =>
            __awaiter(this, void 0, void 0, function* () {
                let userInfo;
                let accessTokenAPIResponse;
                let providerInfo = yield provider.get(redirectURI, code);
                accessTokenAPIResponse = yield axios.default({
                    method: "post",
                    url: providerInfo.accessTokenAPI.url,
                    data: qs.stringify(providerInfo.accessTokenAPI.params),
                    headers: {
                        "content-type": "application/x-www-form-urlencoded",
                        accept: "application/json",
                    },
                });
                userInfo = yield providerInfo.getProfileInfo(accessTokenAPIResponse.data);
                let emailInfo = userInfo.email;
                if (emailInfo === undefined) {
                    return {
                        status: "NO_EMAIL_GIVEN_BY_PROVIDER",
                    };
                }
                let user = yield options.recipeImplementation.signInUp(provider.id, userInfo.id, emailInfo);
                let action = user.createdNewUser ? "signup" : "signin";
                let jwtPayloadPromise = options.config.sessionFeature.setJwtPayload(
                    user.user,
                    accessTokenAPIResponse.data,
                    action
                );
                let sessionDataPromise = options.config.sessionFeature.setSessionData(
                    user.user,
                    accessTokenAPIResponse.data,
                    action
                );
                let jwtPayload = yield jwtPayloadPromise;
                let sessionData = yield sessionDataPromise;
                yield session_1.default.createNewSession(
                    options.req,
                    options.res,
                    user.user.id,
                    jwtPayload,
                    sessionData
                );
                return Object.assign(Object.assign({ status: "OK" }, user), {
                    authCodeResponse: accessTokenAPIResponse,
                });
            });
        this.signOutPOST = (options) =>
            __awaiter(this, void 0, void 0, function* () {
                let session;
                try {
                    session = yield session_1.default.getSession(options.req, options.res);
                } catch (err) {
                    if (
                        session_1.default.Error.isErrorFromSuperTokens(err) &&
                        err.type === session_1.default.Error.UNAUTHORISED
                    ) {
                        // The session is expired / does not exist anyway. So we return OK
                        return {
                            status: "OK",
                        };
                    }
                    throw err;
                }
                if (session === undefined) {
                    throw new Error("Session is undefined. Should not come here.");
                }
                yield session.revokeSession();
                return {
                    status: "OK",
                };
            });
    }
}
exports.default = APIImplementation;
//# sourceMappingURL=implementation.js.map
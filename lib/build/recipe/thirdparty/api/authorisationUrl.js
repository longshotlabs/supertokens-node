"use strict";
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
const utils_1 = require("../../../utils");
const error_1 = require("../error");
const url_1 = require("url");
function authorisationUrlAPI(recipeInstance, req, res, _) {
    return __awaiter(this, void 0, void 0, function* () {
        let queryParams = req.query;
        let thirdPartyId = queryParams.thirdPartyId;
        if (thirdPartyId === undefined || typeof thirdPartyId !== "string") {
            throw new error_1.default(
                {
                    type: error_1.default.BAD_INPUT_ERROR,
                    message: "Please provide the thirdPartyId as a GET param",
                },
                recipeInstance
            );
        }
        let provider = recipeInstance.providers.find((p) => p.id === thirdPartyId);
        if (provider === undefined) {
            throw new error_1.default(
                {
                    type: error_1.default.BAD_INPUT_ERROR,
                    message:
                        "The third party provider " +
                        thirdPartyId +
                        " seems to not be configured on the backend. Please check your frontend and backend configs.",
                },
                recipeInstance
            );
        }
        let providerInfo;
        try {
            providerInfo = yield provider.get(undefined, undefined);
        } catch (err) {
            throw new error_1.default(
                {
                    type: "GENERAL_ERROR",
                    payload: err,
                },
                recipeInstance
            );
        }
        const params = Object.entries(providerInfo.authorisationRedirect.params).reduce(
            (acc, [key, value]) =>
                Object.assign(Object.assign({}, acc), { [key]: typeof value === "function" ? value(req) : value }),
            {}
        );
        let paramsString = new url_1.URLSearchParams(params).toString();
        let url = `${providerInfo.authorisationRedirect.url}?${paramsString}`;
        return utils_1.send200Response(res, {
            status: "OK",
            url,
        });
    });
}
exports.default = authorisationUrlAPI;
//# sourceMappingURL=authorisationUrl.js.map

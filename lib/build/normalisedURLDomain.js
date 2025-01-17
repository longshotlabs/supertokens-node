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
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
const error_1 = require("./error");
const utils_1 = require("./utils");
class NormalisedURLDomain {
    constructor(recipe, url) {
        this.getAsStringDangerous = () => {
            return this.value;
        };
        this.value = normaliseURLDomainOrThrowError(recipe, url);
    }
}
exports.default = NormalisedURLDomain;
function normaliseURLDomainOrThrowError(recipe, input, ignoreProtocol = false) {
    input = input.trim().toLowerCase();
    try {
        if (!input.startsWith("http://") && !input.startsWith("https://") && !input.startsWith("supertokens://")) {
            throw new Error("converting to proper URL");
        }
        let urlObj = new url_1.URL(input);
        if (ignoreProtocol) {
            if (urlObj.hostname.startsWith("localhost") || utils_1.isAnIpAddress(urlObj.hostname)) {
                input = "http://" + urlObj.host;
            } else {
                input = "https://" + urlObj.host;
            }
        } else {
            input = urlObj.protocol + "//" + urlObj.host;
        }
        return input;
    } catch (err) {}
    // not a valid URL
    if (input.startsWith("/")) {
        throw new error_1.default({
            type: error_1.default.GENERAL_ERROR,
            recipe,
            payload: new Error("Please provide a valid domain name"),
        });
    }
    if (input.indexOf(".") === 0) {
        input = input.substr(1);
    }
    // If the input contains a . it means they have given a domain name.
    // So we try assuming that they have given a domain name
    if (
        (input.indexOf(".") !== -1 || input.startsWith("localhost")) &&
        !input.startsWith("http://") &&
        !input.startsWith("https://")
    ) {
        input = "https://" + input;
        // at this point, it should be a valid URL. So we test that before doing a recursive call
        try {
            new url_1.URL(input);
            return normaliseURLDomainOrThrowError(recipe, input, true);
        } catch (err) {}
    }
    throw new error_1.default({
        type: error_1.default.GENERAL_ERROR,
        recipe,
        payload: new Error("Please provide a valid domain name"),
    });
}
exports.normaliseURLDomainOrThrowError = normaliseURLDomainOrThrowError;
//# sourceMappingURL=normalisedURLDomain.js.map

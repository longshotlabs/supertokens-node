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

import STError from "../../error";
import RecipeModule from "../../recipeModule";

export default class SessionError extends STError {
    static UNAUTHORISED: "UNAUTHORISED" = "UNAUTHORISED";
    static TRY_REFRESH_TOKEN: "TRY_REFRESH_TOKEN" = "TRY_REFRESH_TOKEN";
    static TOKEN_THEFT_DETECTED: "TOKEN_THEFT_DETECTED" = "TOKEN_THEFT_DETECTED";

    constructor(
        options:
            | {
                  message: string;
                  type: "UNAUTHORISED";
              }
            | {
                  message: string;
                  type: "TRY_REFRESH_TOKEN";
              }
            | {
                  message: string;
                  type: "TOKEN_THEFT_DETECTED";
                  payload: {
                      userId: string;
                      sessionHandle: string;
                  };
              }
            | {
                  type: "GENERAL_ERROR";
                  payload: Error;
              },
        recipe: RecipeModule | undefined
    ) {
        super({
            ...options,
            recipe,
        });
    }
}

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

import { TypeInput as TypeNormalisedInputEmailVerification } from "../emailverification/types";

const TypeString = {
    type: "string",
};

const TypeBoolean = {
    type: "boolean",
};

const TypeAny = {
    type: "any",
};

export type TypeInputSetJwtPayloadForSession = (
    user: User,
    formFields: TypeFormField[],
    action: "signin" | "signup"
) => Promise<{ [key: string]: any } | undefined>;

export type TypeInputSetSessionDataForSession = (
    user: User,
    formFields: TypeFormField[],
    action: "signin" | "signup"
) => Promise<{ [key: string]: any } | undefined>;

export type TypeInputSessionFeature = {
    setJwtPayload?: TypeInputSetJwtPayloadForSession;
    setSessionData?: TypeInputSetSessionDataForSession;
};

const InputSessionFeatureSchema = {
    type: "object",
    properties: {
        setJwtPayload: TypeAny,
        setSessionData: TypeAny,
    },
    additionalProperties: false,
};

export type TypeNormalisedInputSessionFeature = {
    setJwtPayload: TypeInputSetJwtPayloadForSession;
    setSessionData: TypeInputSetSessionDataForSession;
};

export type TypeNormalisedInput = {
    sessionFeature: TypeNormalisedInputSessionFeature;
    signUpFeature: TypeNormalisedInputSignUp;
    signInFeature: TypeNormalisedInputSignIn;
    resetPasswordUsingTokenFeature: TypeNormalisedInputResetPasswordUsingTokenFeature;
    signOutFeature: TypeNormalisedInputSignOutFeature;
    emailVerificationFeature: TypeNormalisedInputEmailVerification;
};

const InputEmailVerificationFeatureSchema = {
    type: "object",
    properties: {
        disableDefaultImplementation: TypeBoolean,
        getEmailVerificationURL: TypeAny,
        createAndSendCustomEmail: TypeAny,
        handlePostEmailVerification: TypeAny,
    },
    additionalProperties: false,
};

export type TypeInputEmailVerificationFeature = {
    disableDefaultImplementation?: boolean;
    getEmailVerificationURL?: (user: User) => Promise<string>;
    createAndSendCustomEmail?: (user: User, emailVerificationURLWithToken: string) => Promise<void>;
    handlePostEmailVerification?: (user: User) => Promise<void>;
};

export type TypeInputFormField = {
    id: string;
    validate?: (value: any) => Promise<string | undefined>;
    optional?: boolean;
};

export type TypeFormField = { id: string; value: any };

export type TypeInputSignUp = {
    disableDefaultImplementation?: boolean;
    formFields?: TypeInputFormField[];
    // depcrecated
    handleCustomFormFieldsPostSignUp?: (user: User, formFields: TypeFormField[]) => Promise<void>;
    handlePostSignUp?: (user: User, formFields: TypeFormField[]) => Promise<void>;
};

const InputSignUpSchema = {
    type: "object",
    properties: {
        disableDefaultImplementation: TypeBoolean,
        formFields: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: TypeString,
                    validate: TypeAny,
                    optional: TypeBoolean,
                },
                required: ["id"],
                additionalProperties: false,
            },
        },
        handleCustomFormFieldsPostSignUp: TypeAny,
        handlePostSignUp: TypeAny,
    },
    additionalProperties: false,
};

export type NormalisedFormField = {
    id: string;
    validate: (value: any) => Promise<string | undefined>;
    optional: boolean;
};

export type TypeNormalisedInputSignUp = {
    disableDefaultImplementation: boolean;
    formFields: NormalisedFormField[];
    handlePostSignUp: (user: User, formFields: TypeFormField[]) => Promise<void>;
};

export type TypeInputSignIn = {
    disableDefaultImplementation?: boolean;
    handlePostSignIn?: (user: User) => Promise<void>;
};

const InputSignInSchema = {
    type: "object",
    properties: {
        disableDefaultImplementation: TypeBoolean,
        handlePostSignIn: TypeAny,
    },
    additionalProperties: false,
};

export type TypeNormalisedInputSignIn = {
    disableDefaultImplementation: boolean;
    formFields: NormalisedFormField[];
    handlePostSignIn: (user: User) => Promise<void>;
};

export type TypeInputSignOutFeature = {
    disableDefaultImplementation?: boolean;
};

const InputSignOutSchema = {
    type: "object",
    properties: {
        disableDefaultImplementation: TypeBoolean,
    },
    additionalProperties: false,
};

export type TypeNormalisedInputSignOutFeature = {
    disableDefaultImplementation: boolean;
};

export type TypeInputResetPasswordUsingTokenFeature = {
    disableDefaultImplementation?: boolean;
    getResetPasswordURL?: (user: User) => Promise<string>;
    createAndSendCustomEmail?: (user: User, passwordResetURLWithToken: string) => Promise<void>;
};

export const InputResetPasswordUsingTokenFeatureSchema = {
    type: "object",
    properties: {
        disableDefaultImplementation: TypeBoolean,
        getResetPasswordURL: TypeAny,
        createAndSendCustomEmail: TypeAny,
    },
    additionalProperties: false,
};

export type TypeNormalisedInputResetPasswordUsingTokenFeature = {
    disableDefaultImplementation: boolean;
    getResetPasswordURL: (user: User) => Promise<string>;
    createAndSendCustomEmail: (user: User, passwordResetURLWithToken: string) => Promise<void>;
    formFieldsForGenerateTokenForm: NormalisedFormField[];
    formFieldsForPasswordResetForm: NormalisedFormField[];
};

export type TypeNormalisedInputEmailVerificationFeature = {
    disableDefaultImplementation: boolean;
    getEmailVerificationURL: (user: User) => Promise<string>;
    createAndSendCustomEmail: (user: User, emailVerificationURLWithToken: string) => Promise<void>;
    handlePostEmailVerification: (user: User) => Promise<void>;
};

export type User = {
    id: string;
    email: string;
    timeJoined: number;
};

export type TypeInput = {
    sessionFeature?: TypeInputSessionFeature;
    signUpFeature?: TypeInputSignUp;
    signInFeature?: TypeInputSignIn;
    resetPasswordUsingTokenFeature?: TypeInputResetPasswordUsingTokenFeature;
    signOutFeature?: TypeInputSignOutFeature;
    emailVerificationFeature?: TypeInputEmailVerificationFeature;
};

export const InputSchema = {
    type: "object",
    properties: {
        sessionFeature: InputSessionFeatureSchema,
        signUpFeature: InputSignUpSchema,
        signInFeature: InputSignInSchema,
        resetPasswordUsingTokenFeature: InputResetPasswordUsingTokenFeatureSchema,
        signOutFeature: InputSignOutSchema,
        emailVerificationFeature: InputEmailVerificationFeatureSchema,
    },
    additionalProperties: false,
};

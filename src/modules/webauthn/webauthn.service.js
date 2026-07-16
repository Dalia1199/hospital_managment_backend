import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import usermodel from "../../DB/models/usermodel.js";
import passkeyModel from "../../DB/models/passkeyModel.js";
import { setvalue, get, deleletekey } from "../../DB/redis/redis.service.js";
import { successresponse } from "../../common/utilits/responce.success.js";
import {
  access_secret_key,
  refreshsecretkey,
} from "../../../config/config.service.js";
import { generatetoken } from "../../common/utilits/token.service.js";
import { v4 as uuidv4 } from "uuid";
import { getPlanName, getActiveFeatures, getClinicLimit } from "../../common/utilits/subscription.guard.js";
import { AssistantModel } from "../../DB/models/assistant_model.js";
import doctormodel from "../../DB/models/doctormodel.js";
import { roleenum } from "../../common/enum/user.enum.js";

const rpName = "CareHub Hospital";

// Dynamically resolve Relying Party ID to match client's current domain (local IP, localhost, or production domain)
function getRelyingPartyID(req) {
  if (process.env.WEBAUTHN_RP_ID) {
    return process.env.WEBAUTHN_RP_ID;
  }
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      if (origin.startsWith("http://") || origin.startsWith("https://")) {
        return new URL(origin).hostname;
      }
      return origin.split(":")[0];
    } catch (e) {
      console.error("Error parsing request origin/referer in getRelyingPartyID:", e.message);
    }
  }
  return "localhost";
}

// Dynamically resolve client origin to support local dev, mobile access, and production deployments
function getClientOrigin(req) {
  const origin = req.headers.origin;
  if (origin) return origin;

  const referer = req.headers.referer;
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch (e) {
      console.error("Error parsing referer in getClientOrigin:", e.message);
    }
  }
  return "https://carehub-two.vercel.app";
}

export const registerOptions = async (req, res, next) => {
  try {
    const user = req.user; // from auth middleware
    const rpID = getRelyingPartyID(req);

    // Get user's existing passkeys
    const userPasskeys = await passkeyModel.find({ userId: user._id });

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Uint8Array.from(Buffer.from(user._id.toString())),
      userName: user.email,
      userDisplayName: user.fullName,
      // Prevent registering same authenticator multiple times
      excludeCredentials: userPasskeys.map((passkey) => ({
        id: passkey.credentialID,
        type: "public-key",
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        // No attachment restriction — supports TouchID, FaceID, Windows Hello, Android fingerprint, and hardware keys
      },
    });

    // Store the challenge in Redis (expires in 5 minutes)
    await setvalue({
      key: `webauthn:challenge:register:${user._id}`,
      value: options.challenge,
      ttl: 300,
    });

    return res.status(200).json({
      message: "Registration options generated",
      data: options,
    });
  } catch (error) {
    next(error);
  }
};

export const registerVerification = async (req, res, next) => {
  try {
    const user = req.user;
    const { credential } = req.body;
    const rpID = getRelyingPartyID(req);

    if (!credential) {
      return res
        .status(400)
        .json({ message: "Credential registration response is required." });
    }

    const expectedChallenge = await get(
      `webauthn:challenge:register:${user._id}`
    );
    if (!expectedChallenge) {
      return res
        .status(400)
        .json({ message: "Registration challenge expired or not found." });
    }

    const clientOrigin = getClientOrigin(req);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: clientOrigin,
        expectedRPID: rpID,
      });
    } catch (error) {
      console.error("WebAuthn verifyRegistrationResponse error:", error);
      return res
        .status(400)
        .json({ message: "Verification failed", error: error.message });
    }

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const credentialInfo = registrationInfo.credential;
      const publicKey = credentialInfo ? credentialInfo.publicKey : registrationInfo.credentialPublicKey;
      const id = credentialInfo ? credentialInfo.id : registrationInfo.credentialID;
      const counter = registrationInfo.counter;

      if (!publicKey || !id) {
        return res
          .status(400)
          .json({ message: "Verification response missing credential public key or ID." });
      }

      const base64PublicKey = typeof publicKey === "string"
        ? publicKey
        : Buffer.from(publicKey).toString("base64url");
      const base64CredentialID = typeof id === "string"
        ? id
        : Buffer.from(id).toString("base64url");

      await passkeyModel.create({
        userId: user._id,
        credentialID: base64CredentialID,
        publicKey: base64PublicKey,
        counter,
        deviceType: registrationInfo.credentialDeviceType,
        backedUp: registrationInfo.credentialBackedUp,
        transports: credential.transports || [],
      });

      // Clear challenge from Redis
      await deleletekey(`webauthn:challenge:register:${user._id}`);

      return successcall(res, 201, "Biometrics registered successfully");
    } else {
      return res
        .status(400)
        .json({ message: "Verification could not be verified." });
    }
  } catch (error) {
    next(error);
  }
};

// Helper for consistency with original success response helper
function successcall(res, status, message) {
  return successresponse({
    res,
    status,
    message,
  });
}

export const loginOptions = async (req, res, next) => {
  try {
    const { email } = req.body;
    const rpID = getRelyingPartyID(req);

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required to request biometric login." });
    }

    const user = await usermodel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with this email." });
    }

    if (user.status === "blocked") {
      return res
        .status(403)
        .json({ message: "Account is deactivated. Contact admin." });
    }

    // Get user's existing passkeys
    const userPasskeys = await passkeyModel.find({ userId: user._id });
    if (!userPasskeys.length) {
      return res
        .status(400)
        .json({ message: "No biometrics registered for this account." });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userPasskeys.map((passkey) => ({
        id: passkey.credentialID,
        type: "public-key",
        transports: passkey.transports,
      })),
      userVerification: "preferred",
    });

    // Store challenge in Redis
    await setvalue({
      key: `webauthn:challenge:login:${email}`,
      value: options.challenge,
      ttl: 300,
    });

    return res.status(200).json({
      message: "Authentication options generated",
      data: options,
    });
  } catch (error) {
    next(error);
  }
};

export const loginVerification = async (req, res, next) => {
  try {
    const { email, credential } = req.body;
    const rpID = getRelyingPartyID(req);

    if (!email || !credential) {
      return res
        .status(400)
        .json({ message: "Email and credential response are required." });
    }

    const user = await usermodel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.status === "blocked") {
      return res
        .status(403)
        .json({ message: "Account is deactivated. Contact admin." });
    }

    const expectedChallenge = await get(`webauthn:challenge:login:${email}`);
    if (!expectedChallenge) {
      return res
        .status(400)
        .json({ message: "Authentication challenge expired or not found." });
    }

    const dbPasskey = await passkeyModel.findOne({
      userId: user._id,
      credentialID: credential.id,
    });

    if (!dbPasskey) {
      return res
        .status(400)
        .json({
          message: "Biometrics credential not recognized for this user.",
        });
    }

    const clientOrigin = getClientOrigin(req);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: clientOrigin,
        expectedRPID: rpID,
        credential: {
          id: dbPasskey.credentialID,
          publicKey: Buffer.from(dbPasskey.publicKey, "base64url"),
          counter: dbPasskey.counter,
          transports: dbPasskey.transports,
        },
      });
    } catch (error) {
      console.error("WebAuthn verifyAuthenticationResponse error:", error);
      return res
        .status(400)
        .json({
          message: "Biometrics verification failed",
          error: error.message,
        });
    }

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      dbPasskey.counter = authenticationInfo.newCounter;
      await dbPasskey.save();

      // Clear challenge from Redis
      await deleletekey(`webauthn:challenge:login:${email}`);

      // Success signin - generate JWT Access Token & Refresh Token
      const uuid = uuidv4();
      const access_token = generatetoken({
        payload: { id: user._id, email: user.email },
        secret_key: access_secret_key,
        options: {
          expiresIn: "25h",
          jwtid: uuid,
        },
      });
      const refreshtoken = generatetoken({
        payload: {
          id: user._id,
          email: user.email,
        },
        secret_key: refreshsecretkey,
        options: {
          expiresIn: "20h",
          jwtid: uuid,
        },
      });

      let assistantData = null;
      let subscriptionPlan = "Free";
      let subscriptionFeatures = [];
      let clinicLimit = 0;

      if (user.role === roleenum.assistant) {
        assistantData = await AssistantModel.findOne({ userId: user._id })
          .populate('doctorId', 'fullName')
          .populate('clinicId', 'name');
      } else if (user.role === roleenum.doctor) {
        const doctor = await doctormodel.findOne({ userId: user._id }).lean();
        if (doctor) {
          subscriptionPlan = await getPlanName(user._id);
          subscriptionFeatures = await getActiveFeatures(user._id);
          clinicLimit = await getClinicLimit(user._id);
        }
      }

      return successresponse({
        res,
        message: "success signin via biometrics",
        data: {
          access_token,
          refreshtoken,
          email: user.email,
          role: user.role,
          id: user._id,
          fullName: user.fullName,
          profilepicture: user.profilepicture,
          ...(user.role === roleenum.doctor && {
            subscriptionPlan,
            subscriptionFeatures,
            clinicLimit
          }),
          ...(assistantData && {
            permissions: assistantData.permissions,
            doctorId: assistantData.doctorId?._id || assistantData.doctorId,
            jobTitle: assistantData.jobTitle,
            doctorName: assistantData.doctorId?.fullName,
            clinicId: assistantData.clinicId?._id || assistantData.clinicId,
            clinicName: assistantData.clinicId?.name
          })
        },
      });
    } else {
      return res.status(400).json({ message: "Verification failed." });
    }
  } catch (error) {
    next(error);
  }
};

export const getBiometricStatus = async (req, res, next) => {
  try {
    const user = req.user;
    const userPasskeys = await passkeyModel.find({ userId: user._id });
    return res.status(200).json({
      message: "Biometrics status retrieved",
      data: {
        hasBiometrics: userPasskeys.length > 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const removeBiometrics = async (req, res, next) => {
  try {
    const user = req.user;
    await passkeyModel.deleteMany({ userId: user._id });
    return successresponse({
      res,
      status: 200,
      message: "Biometrics disabled successfully",
    });
  } catch (error) {
    next(error);
  }
};

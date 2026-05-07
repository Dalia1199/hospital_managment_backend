export const emailtemplete=(otp)=>{
    return `<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>OTP Verification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }

        .container {
            max-width: 500px;
            margin: 50px auto;
            background: #ffffff;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .otp {
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #2d6cdf;
            margin: 20px 0;
            padding: 10px;
            background: #f0f4ff;
            display: inline-block;
            border-radius: 8px;
        }

        .footer {
            font-size: 12px;
            color: #888;
            margin-top: 20px;
        }
    </style>
</head>

<body>
    <div class="container">
        <h2>Email Verification</h2>
        <p>Hello,</p>
        <p>Your One-Time Password (OTP) for verification is:</p>

        <div class="otp"> code:${otp}</div>

        <p>This code is valid for a few minutes. Do not share it with anyone.</p>

        <div class="footer">
            If you didn’t request this, you can ignore this email.
        </div>
    </div>
</body>

</html>`

}
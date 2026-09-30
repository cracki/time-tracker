import { describe, it, expect, vi, afterEach } from "vitest";
import { sendOtpSms, sendSms, isSmsConfigured, smsProvider } from "@/lib/server/sms";

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

function stubFetch(handler: (...a: Parameters<typeof fetch>) => Promise<Response>) {
  vi.stubGlobal("fetch", handler);
}

describe("configuration detection", () => {
  it("is dev mode (none) without env", () => {
    vi.stubEnv("SMS_PROVIDER", "");
    vi.stubEnv("KAVENEGAR_API_KEY", "");
    expect(smsProvider()).toBe("none");
    expect(isSmsConfigured()).toBe(false);
  });

  it("requires key AND template for kavenegar", () => {
    vi.stubEnv("SMS_PROVIDER", "kavenegar");
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "");
    expect(isSmsConfigured()).toBe(false);
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "otp-template");
    expect(isSmsConfigured()).toBe(true);
  });
});

describe("sendOtpSms (Kavenegar verify/lookup)", () => {
  it("calls the Lookup endpoint with receptor/token/template", async () => {
    vi.stubEnv("SMS_PROVIDER", "kavenegar");
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "time-otp");

    let capturedUrl = "";
    stubFetch(async (input) => {
      capturedUrl = String(input);
      return Response.json({ return: { status: 200, message: "تایید شد" } });
    });

    await sendOtpSms("09121111111", "12345");
    expect(capturedUrl).toContain("https://api.kavenegar.com/v1/test-key/verify/lookup.json");
    const url = new URL(capturedUrl);
    expect(url.searchParams.get("receptor")).toBe("09121111111");
    expect(url.searchParams.get("token")).toBe("12345");
    expect(url.searchParams.get("template")).toBe("time-otp");
  });

  it("normalizes +98/98/10-digit receptors to 09…", async () => {
    vi.stubEnv("SMS_PROVIDER", "kavenegar");
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "t");

    const receptors: string[] = [];
    stubFetch(async (input) => {
      receptors.push(new URL(String(input)).searchParams.get("receptor")!);
      return Response.json({ return: { status: 200, message: "ok" } });
    });

    await sendOtpSms("+989121111111", "1");
    await sendOtpSms("989121111111", "1");
    await sendOtpSms("9121111111", "1");
    expect(receptors).toEqual(["09121111111", "09121111111", "09121111111"]);
  });

  it("throws Persian SmsError when Kavenegar returns non-200 status", async () => {
    vi.stubEnv("SMS_PROVIDER", "kavenegar");
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "t");

    stubFetch(async () => Response.json({ return: { status: 418, message: "template not found" } }));
    await expect(sendOtpSms("09121111111", "1")).rejects.toThrow(/قالب|کاوه‌نگار|418|template/i);
  });

  it("maps network failure to a Persian connection error", async () => {
    vi.stubEnv("SMS_PROVIDER", "kavenegar");
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "t");

    stubFetch(async () => { throw new Error("ECONNREFUSED"); });
    await expect(sendOtpSms("09121111111", "1")).rejects.toThrow("اتصال به کاوه‌نگار");
  });

  it("fails fast without a template configured", async () => {
    vi.stubEnv("SMS_PROVIDER", "kavenegar");
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_OTP_TEMPLATE", "");
    await expect(sendOtpSms("09121111111", "1")).rejects.toThrow("KAVENEGAR_OTP_TEMPLATE");
  });
});

describe("sendSms (direct send path uses the service line)", () => {
  it("includes sender + joined receptors", async () => {
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_SENDER", "10008663");

    let capturedUrl = "";
    stubFetch(async (input) => {
      capturedUrl = String(input);
      return Response.json({ return: { status: 200, message: "ok" } });
    });

    await sendSms(["09121111111", "+989120000002"], "سلام");
    const url = new URL(capturedUrl);
    expect(capturedUrl).toContain("/sms/send.json");
    expect(url.searchParams.get("sender")).toBe("10008663");
    expect(url.searchParams.get("receptor")).toBe("09121111111,09120000002");
  });

  it("requires KAVENEGAR_SENDER", async () => {
    vi.stubEnv("KAVENEGAR_API_KEY", "test-key");
    vi.stubEnv("KAVENEGAR_SENDER", "");
    await expect(sendSms(["09121111111"], "m")).rejects.toThrow("KAVENEGAR_SENDER");
  });
});

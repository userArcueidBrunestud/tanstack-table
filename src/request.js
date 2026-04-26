/* ================================================================
 * request.js — vanilla JS 版，搬自 @/utils/request.ts
 *
 * 原版用 axios + FormData + Cookie 鉴权，这里用 fetch 等效实现。
 * 接口签名保持一致：post(url, params?, project?, customBaseURL?)
 * ================================================================ */

const BASE_URL = "https://bi-ssl.alperp.cn";

function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function getLoginInfo() {
  const loginCookie = getCookie("loginInfoCookie");
  if (loginCookie) {
    try {
      return JSON.parse(loginCookie);
    } catch {
      /* ignore */
    }
  }
  return {};
}

function buildFormData(params) {
  if (!params) return new FormData();

  if (params instanceof FormData) {
    const fd = new FormData();
    for (const [k, v] of params.entries()) fd.append(k, v);
    return fd;
  }

  const fd = new FormData();
  Object.keys(params).forEach((key) => {
    fd.append(key, params[key]);
  });
  return fd;
}

/**
 * post — 搬自 request.ts post()
 * 所有请求统一走 POST + FormData，自动拼接 project/_t/webCookie/WebType。
 *
 * @param {string} url         接口路径，如 "/sys_cell_page/List"
 * @param {object|FormData}    请求参数
 * @param {string} project     project 字段，默认 "bi"
 * @param {string} customBaseURL 自定义 baseURL（可选）
 * @returns {Promise<any>}     直接返回 response.data
 */
export async function post(url, params, project, customBaseURL) {
  let getUrl = url;
  const t = Math.floor(Date.now() / 1000);

  if (getUrl.includes("?")) {
    getUrl += `&project=${project || "bi"}&_t=${t}`;
  } else {
    getUrl += `?project=${project || "bi"}&_t=${t}`;
  }

  const formData = buildFormData(params);
  formData.append("webCookie", "true");
  formData.append("WebType", "CRM");

  const loginInfo = getLoginInfo();
  const webCookie = [
    `web_userid=${loginInfo.app_userid || ""}`,
    `web_companyid=${loginInfo.app_companyid || ""}`,
    `web_groupid=${loginInfo.app_groupid || ""}`,
    `web_token=${loginInfo.app_token || ""}`,
    `webcode=${loginInfo.webcode || ""}`,
    `web_code=sys`,
  ].join(";");

  const baseURL = customBaseURL || BASE_URL;

  const resp = await fetch(baseURL + getUrl, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "*/*",
      WebCookie: webCookie,
    },
  });

  if (!resp.ok) {
    throw new Error("请求失败！路径：" + url);
  }

  return resp.json();
}

/**
 * get — 搬自 request.ts get()
 * 原组件 get 直接调用 post，这里保持一致。
 */
export async function get(url, params, config, project) {
  return post(url, params, project);
}

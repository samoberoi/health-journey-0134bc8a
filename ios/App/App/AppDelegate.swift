import UIKit
import Capacitor
import HealthKit
import LocalAuthentication
import Security
import AparajitaCapacitorBiometricAuth
import AppPlugin
import PreferencesPlugin

private func bbdoNativeLog(_ message: String) {
    NSLog("[BBDO native] %@", message)
}

@objc(BBDOBiometricsPlugin)
public class BBDOBiometricsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BBDOBiometricsPlugin"
    public let jsName = "BBDOBiometrics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "check", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise)
    ]

    private func label(for type: LABiometryType) -> String {
        switch type {
        case .faceID:
            return "Face ID"
        case .touchID:
            return "Touch ID"
        default:
            return "Face ID / Touch ID"
        }
    }

    private func typeName(for type: LABiometryType) -> String {
        switch type {
        case .faceID:
            return "faceId"
        case .touchID:
            return "touchId"
        default:
            return "none"
        }
    }

    @objc func check(_ call: CAPPluginCall) {
        bbdoNativeLog("BBDOBiometrics.check invoked")
        let context = LAContext()
        var authError: NSError?
        let canUseDeviceAuth = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &authError)

        var biometricError: NSError?
        let canUseBiometrics = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &biometricError)
        let biometryType = context.biometryType

        call.resolve([
            "available": canUseDeviceAuth,
            "biometryAvailable": canUseBiometrics,
            "deviceSecure": canUseDeviceAuth,
            "biometryType": typeName(for: biometryType),
            "label": label(for: biometryType),
            "code": canUseDeviceAuth ? "available" : (authError?.code.description ?? "unavailable"),
            "reason": canUseDeviceAuth ? "Device authentication is available." : (authError?.localizedDescription ?? "Device authentication is unavailable.")
        ])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        bbdoNativeLog("BBDOBiometrics.authenticate invoked")
        let reason = call.getString("reason") ?? "Unlock bye bye diabetes"
        let context = LAContext()
        context.localizedFallbackTitle = "Use Passcode"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            call.reject(error?.localizedDescription ?? "Device authentication is unavailable", "unavailable")
            return
        }

        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authError in
            DispatchQueue.main.async {
                if success {
                    call.resolve(["success": true])
                } else {
                    call.reject(authError?.localizedDescription ?? "Authentication failed", "authenticationFailed")
                }
            }
        }
    }
}

@objc(BBDOHealthKitPlugin)
public class BBDOHealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BBDOHealthKitPlugin"
    public let jsName = "BBDOHealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getTodayStepCount", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()

    @objc func isAvailable(_ call: CAPPluginCall) {
        bbdoNativeLog("BBDOHealthKit.isAvailable invoked")
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        bbdoNativeLog("BBDOHealthKit.requestAuthorization invoked")
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health is not available on this device", "healthkitUnavailable")
            return
        }
        guard let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            call.reject("Step count is not available", "stepTypeUnavailable")
            return
        }

        healthStore.requestAuthorization(toShare: [], read: [stepType]) { success, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription, "authorizationFailed")
                    return
                }
                call.resolve(["granted": success])
            }
        }
    }

    @objc func getTodayStepCount(_ call: CAPPluginCall) {
        bbdoNativeLog("BBDOHealthKit.getTodayStepCount invoked")
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health is not available on this device", "healthkitUnavailable")
            return
        }
        guard let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            call.reject("Step count is not available", "stepTypeUnavailable")
            return
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let now = Date()
        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: now, options: .strictStartDate)
        let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription, "stepQueryFailed")
                    return
                }
                let steps = result?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
                call.resolve([
                    "steps": Int(steps.rounded()),
                    "startDate": ISO8601DateFormatter().string(from: startOfDay),
                    "endDate": ISO8601DateFormatter().string(from: now)
                ])
            }
        }
        healthStore.execute(query)
    }
}

@objc(BBDONativeAuthStorePlugin)
public class BBDONativeAuthStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BBDONativeAuthStorePlugin"
    public let jsName = "BBDONativeAuthStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTokens", returnType: CAPPluginReturnPromise)
    ]

    private let service = "app.lovable.byebyediabetes.auth"
    private let account = "session"

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    @objc func getTokens(_ call: CAPPluginCall) {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            call.resolve(["hasTokens": false])
            return
        }

        do {
            let object = try JSONSerialization.jsonObject(with: data) as? [String: String]
            call.resolve([
                "hasTokens": true,
                "access_token": object?["access_token"] ?? "",
                "refresh_token": object?["refresh_token"] ?? ""
            ])
        } catch {
            call.reject("Stored auth tokens are unreadable", "decodeFailed")
        }
    }

    @objc func setTokens(_ call: CAPPluginCall) {
        guard let accessToken = call.getString("access_token"), let refreshToken = call.getString("refresh_token") else {
            call.reject("Missing auth tokens", "missingTokens")
            return
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: [
                "access_token": accessToken,
                "refresh_token": refreshToken
            ])
            SecItemDelete(baseQuery() as CFDictionary)
            var attributes = baseQuery()
            attributes[kSecValueData as String] = data
            attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let status = SecItemAdd(attributes as CFDictionary, nil)
            if status == errSecSuccess {
                bbdoNativeLog("Native auth tokens stored in Keychain")
                call.resolve(["saved": true])
            } else {
                call.reject("Keychain save failed", "keychainSaveFailed", NSError(domain: NSOSStatusErrorDomain, code: Int(status)))
            }
        } catch {
            call.reject(error.localizedDescription, "encodeFailed")
        }
    }

    @objc func clearTokens(_ call: CAPPluginCall) {
        SecItemDelete(baseQuery() as CFDictionary)
        call.resolve(["cleared": true])
    }
}

@objc(BBDOBridgeViewController)
class BBDOBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bbdoNativeLog("BBDOBridgeViewController.capacitorDidLoad")
        bridge?.registerPluginInstance(BBDOBiometricsPlugin())
        bridge?.registerPluginInstance(BBDONativeAuthStorePlugin())
        bridge?.registerPluginInstance(BBDOHealthKitPlugin())
        bbdoNativeLog("Custom native plugins registered")
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        bbdoNativeLog("application didFinishLaunching")
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

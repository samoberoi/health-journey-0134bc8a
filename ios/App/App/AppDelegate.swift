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
        CAPPluginMethod(name: "getTodayStepCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getHealthSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveWeight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enableBackgroundSync", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()
    private var backgroundObserversStarted = false

    private func readTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()
        let ids: [HKQuantityTypeIdentifier] = [
            .stepCount, .activeEnergyBurned, .distanceWalkingRunning,
            .appleExerciseTime, .bodyMass, .restingHeartRate,
            .heartRateVariabilitySDNN, .bloodGlucose
        ]
        for id in ids {
            if let t = HKQuantityType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(sleep)
        }
        return types
    }

    private func shareTypes() -> Set<HKSampleType> {
        var types = Set<HKSampleType>()
        if let w = HKQuantityType.quantityType(forIdentifier: .bodyMass) { types.insert(w) }
        return types
    }

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
        healthStore.requestAuthorization(toShare: shareTypes(), read: readTypes()) { success, error in
            DispatchQueue.main.async {
                if let error = error {
                    call.reject(error.localizedDescription, "authorizationFailed")
                    return
                }
                call.resolve(["granted": success])
            }
        }
    }

    // MARK: - Write-back (weight)

    @objc func saveWeight(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            call.reject("Apple Health is not available", "healthkitUnavailable"); return
        }
        let kg = call.getDouble("kg") ?? 0
        guard kg > 0 else { call.reject("Invalid weight", "invalidValue"); return }
        let date = call.getString("at").flatMap { ISO8601DateFormatter().date(from: $0) } ?? Date()
        let sample = HKQuantitySample(
            type: type,
            quantity: HKQuantity(unit: HKUnit.gramUnit(with: .kilo), doubleValue: kg),
            start: date, end: date
        )
        healthStore.save(sample) { ok, err in
            DispatchQueue.main.async {
                if let err = err { call.reject(err.localizedDescription, "saveFailed"); return }
                call.resolve(["saved": ok])
            }
        }
    }

    // MARK: - Background delivery

    @objc func enableBackgroundSync(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health is not available", "healthkitUnavailable"); return
        }
        if backgroundObserversStarted { call.resolve(["enabled": true]); return }
        backgroundObserversStarted = true

        let watchIds: [HKQuantityTypeIdentifier] = [
            .stepCount, .heartRate, .restingHeartRate,
            .heartRateVariabilitySDNN, .bloodGlucose, .bodyMass
        ]
        let plugin = self
        for id in watchIds {
            guard let type = HKQuantityType.quantityType(forIdentifier: id) else { continue }
            let observer = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, _ in
                DispatchQueue.main.async {
                    plugin.notifyListeners("healthDataChanged", data: ["type": id.rawValue])
                }
                completion()
            }
            healthStore.execute(observer)
            healthStore.enableBackgroundDelivery(for: type, frequency: .immediate) { _, _ in }
        }
        call.resolve(["enabled": true])
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

        let startOfDay = Calendar.current.startOfDay(for: Date())
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

    // MARK: - Snapshot

    private func sumToday(_ id: HKQuantityTypeIdentifier, unit: HKUnit, completion: @escaping (Double) -> Void) {
        guard let type = HKQuantityType.quantityType(forIdentifier: id) else { completion(0); return }
        let start = Calendar.current.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
        let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, _ in
            completion(result?.sumQuantity()?.doubleValue(for: unit) ?? 0)
        }
        healthStore.execute(q)
    }

    private func mostRecent(_ id: HKQuantityTypeIdentifier, unit: HKUnit, completion: @escaping (Double?, Date?) -> Void) {
        guard let type = HKQuantityType.quantityType(forIdentifier: id) else { completion(nil, nil); return }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let q = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            if let s = samples?.first as? HKQuantitySample {
                completion(s.quantity.doubleValue(for: unit), s.endDate)
            } else {
                completion(nil, nil)
            }
        }
        healthStore.execute(q)
    }

    private func lastNightSleepHours(completion: @escaping (Double) -> Void) {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { completion(0); return }
        let cal = Calendar.current
        let now = Date()
        // Window: yesterday 18:00 → today 12:00
        var comps = cal.dateComponents([.year, .month, .day], from: now)
        comps.hour = 12
        let noonToday = cal.date(from: comps) ?? now
        let start = cal.date(byAdding: .hour, value: -18, to: noonToday) ?? now
        let predicate = HKQuery.predicateForSamples(withStart: start, end: noonToday, options: [])
        let q = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
            var seconds: TimeInterval = 0
            for s in (samples as? [HKCategorySample]) ?? [] {
                let val = s.value
                let isAsleep: Bool
                if #available(iOS 16.0, *) {
                    isAsleep = val == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
                        || val == HKCategoryValueSleepAnalysis.asleepCore.rawValue
                        || val == HKCategoryValueSleepAnalysis.asleepDeep.rawValue
                        || val == HKCategoryValueSleepAnalysis.asleepREM.rawValue
                } else {
                    isAsleep = val == HKCategoryValueSleepAnalysis.asleep.rawValue
                }
                if isAsleep {
                    seconds += s.endDate.timeIntervalSince(s.startDate)
                }
            }
            completion(seconds / 3600.0)
        }
        healthStore.execute(q)
    }

    @objc func getHealthSnapshot(_ call: CAPPluginCall) {
        bbdoNativeLog("BBDOHealthKit.getHealthSnapshot invoked")
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health is not available on this device", "healthkitUnavailable")
            return
        }

        let group = DispatchGroup()
        var result: [String: Any] = [:]

        group.enter()
        sumToday(.stepCount, unit: .count()) { v in result["steps"] = Int(v.rounded()); group.leave() }
        group.enter()
        sumToday(.activeEnergyBurned, unit: .kilocalorie()) { v in result["activeCalories"] = Int(v.rounded()); group.leave() }
        group.enter()
        sumToday(.distanceWalkingRunning, unit: HKUnit.meter()) { v in result["distanceMeters"] = Int(v.rounded()); group.leave() }
        group.enter()
        sumToday(.appleExerciseTime, unit: .minute()) { v in result["exerciseMinutes"] = Int(v.rounded()); group.leave() }

        group.enter()
        mostRecent(.bodyMass, unit: HKUnit.gramUnit(with: .kilo)) { v, d in
            if let v = v { result["weightKg"] = v }
            if let d = d { result["weightAt"] = ISO8601DateFormatter().string(from: d) }
            group.leave()
        }
        group.enter()
        mostRecent(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute())) { v, d in
            if let v = v { result["restingHeartRate"] = Int(v.rounded()) }
            if let d = d { result["restingHeartRateAt"] = ISO8601DateFormatter().string(from: d) }
            group.leave()
        }
        group.enter()
        mostRecent(.heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli)) { v, d in
            if let v = v { result["hrvMs"] = Int(v.rounded()) }
            if let d = d { result["hrvAt"] = ISO8601DateFormatter().string(from: d) }
            group.leave()
        }
        group.enter()
        mostRecent(.bloodGlucose, unit: HKUnit(from: "mg/dL")) { v, d in
            if let v = v { result["glucoseMgDl"] = Int(v.rounded()) }
            if let d = d { result["glucoseAt"] = ISO8601DateFormatter().string(from: d) }
            group.leave()
        }
        group.enter()
        lastNightSleepHours { hours in result["sleepHours"] = (hours * 10).rounded() / 10.0; group.leave() }

        group.notify(queue: .main) {
            call.resolve(result)
        }
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

    // MARK: - APNs push forwarding
    // Capacitor's PushNotifications plugin listens on NotificationCenter for these
    // events. Without these UIApplicationDelegate methods the plugin never receives
    // the device token and `register()` silently fails.

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        bbdoNativeLog("APNs registered device token")
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        bbdoNativeLog("APNs registration failed: \(error.localizedDescription)")
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
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

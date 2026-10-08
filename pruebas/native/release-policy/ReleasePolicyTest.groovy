import org.gradle.api.GradleException

// Groovy/Gradle reales; solo el DSL Android/proyecto/graph se sustituyen.
class Signing {
    File storeFile
    String storePassword, keyAlias, keyPassword
    void storeFile(File value) { this.storeFile = value }
    void storePassword(String value) { this.storePassword = value }
    void keyAlias(String value) { this.keyAlias = value }
    void keyPassword(String value) { this.keyPassword = value }
}
class Signings {
    Signing release = new Signing()
    void release(Closure action) { action.delegate = release; action.resolveStrategy = Closure.DELEGATE_FIRST; action() }
}
class BuildType {
    Object signingConfig = "debug-old"
    void signingConfig(Object value) { this.signingConfig = value }
}
class AndroidDsl {
    Signings signingConfigs = new Signings()
    def buildTypes = new Expando(release: new BuildType())
    void signingConfigs(Closure action) { action.delegate = signingConfigs; action.resolveStrategy = Closure.DELEGATE_FIRST; action() }
}
class Graph {
    List allTasks = []
    Closure check
    void whenReady(Closure action) { check = action }
}
def code = 'import org.gradle.api.GradleException\n' + new File(args[0]).getText('UTF-8')
def run = { List requested, List actual ->
    def project = new Object()
    def android = new AndroidDsl()
    def graph = new Graph(allTasks: actual.collect { [name: it, project: project] })
    def gradle = new Expando(startParameter: new Expando(taskNames: requested), taskGraph: graph)
    def bind = new Binding([gradle: gradle, project: project,
        findProperty: { String key -> null }, file: { String name -> new File(name) },
        android: { Closure action -> action.delegate = android; action.resolveStrategy = Closure.DELEGATE_FIRST; action() }])
    new GroovyShell(this.class.classLoader, bind).evaluate(code)
    graph.check(graph)
    assert android.buildTypes.release.signingConfig.is(android.signingConfigs.release)
    return android.signingConfigs.release
}
if (args[1] == 'missing') {
    run([':app:compileDebugKotlin'], ['compileDebugKotlin'])
    for (String task : ['bundleRelease', 'assembleRelease', 'installRelease', 'validateSigningRelease']) {
        try { run([task], [task]); assert false : 'release sin credenciales' }
        catch (GradleException e) { assert e.message.contains('FINZO_*') }
    }
    for (String task : ['bundleRelease', 'packageProductionRelease', 'validateSigningRelease', 'installRelease']) {
        try { run(['build'], [task]); assert false : 'tarea agregada evade firma' }
        catch (GradleException e) { assert e.message.contains('FINZO_*') }
    }
} else {
    def config = run(['bundleRelease'], ['validateSigningRelease', 'bundleRelease'])
    assert config.storeFile.name == 'dummy-upload.keystore'
    assert config.keyAlias == 'dummy-upload-key'
    assert config.storePassword == 'dummy-only-test'
    assert config.keyPassword == 'dummy-only-test'
}
println('Firma: politica Groovy original correcta; DSL/graph Android adaptados, no se firma ningun archivo.')

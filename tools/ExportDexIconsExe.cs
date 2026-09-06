using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Reflection;
using System.Resources;
using System.Security.Cryptography;
using System.Text;

internal static class ExportDexIconsExe
{
    static string Hash(byte[] bytes) { using (var sha = SHA256.Create()) { var result = new StringBuilder(); foreach (var value in sha.ComputeHash(bytes)) result.Append(value.ToString("x2")); return result.ToString(); } }
    static string Quote(string value) { return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\""; }
    public static int Main(string[] args)
    {
        if (args.Length != 3) return 2;
        Directory.CreateDirectory(args[1]);
        var assembly = Assembly.LoadFrom(args[0]);
        string resource = null;
        foreach (var name in assembly.GetManifestResourceNames()) if (name.IndexOf("Resource Image.resources", StringComparison.OrdinalIgnoreCase) >= 0) { resource = name; break; }
        if (resource == null) throw new InvalidOperationException("embedded image resource not found");
        var entries = new SortedDictionary<string, string>(StringComparer.Ordinal);
        using (var stream = assembly.GetManifestResourceStream(resource))
        using (var reader = new ResourceReader(stream))
        {
            foreach (DictionaryEntry entry in reader)
            {
                var key = entry.Key as string; var image = entry.Value as Image;
                if (key == null || image == null || !key.StartsWith("Itm_", StringComparison.Ordinal)) continue;
                using (image) using (var output = new MemoryStream())
                {
                    image.Save(output, ImageFormat.Png); var bytes = output.ToArray(); var file = Hash(bytes) + ".png"; var target = Path.Combine(args[1], file);
                    if (!File.Exists(target)) File.WriteAllBytes(target, bytes); entries[key] = "catalog/icons/" + file;
                }
            }
        }
        using (var output = new StreamWriter(args[2], false, new UTF8Encoding(false)))
        {
            output.WriteLine("{\n  \"format\": \"mh-save-edit-icon-manifest-v1\",\n  \"source\": " + Quote(Path.GetFileName(args[0])) + ",\n  \"count\": " + entries.Count + ",\n  \"icons\": {");
            var index = 0; foreach (var entry in entries) { output.Write("    " + Quote(entry.Key) + ": " + Quote(entry.Value)); output.WriteLine(++index == entries.Count ? "" : ","); }
            output.WriteLine("  }\n}");
        }
        Console.WriteLine("exported " + entries.Count + " item resources"); return 0;
    }
}

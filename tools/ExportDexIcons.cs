using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Resources;
using System.Security.Cryptography;
using System.Text;

/// <summary>
/// Exports selected bitmap key prefixes from a .NET .resources file. The
/// output is content-addressed so identical icons are stored once across games.
/// </summary>
internal static class ExportDexIcons
{
    private static string Json(string value)
    {
        return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
    }

    private static string Hash(byte[] bytes)
    {
        using (var sha = SHA256.Create())
        {
            var digest = sha.ComputeHash(bytes);
            var result = new StringBuilder(digest.Length * 2);
            foreach (var value in digest) result.Append(value.ToString("x2"));
            return result.ToString();
        }
    }

    private static bool MatchesPrefix(string key, string[] prefixes)
    {
        foreach (var prefix in prefixes)
        {
            if (key.StartsWith(prefix, StringComparison.Ordinal)) return true;
        }
        return false;
    }

    public static int Main(string[] args)
    {
        if (args.Length != 3 && args.Length != 4)
        {
            Console.Error.WriteLine("usage: ExportDexIcons <input.resources> <output-dir> <manifest.json> [prefixes]");
            return 2;
        }

        Directory.CreateDirectory(args[1]);
        var entries = new SortedDictionary<string, string>(StringComparer.Ordinal);
        var prefixes = (args.Length == 4 ? args[3] : "Itm_").Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);

        using (var reader = new ResourceReader(args[0]))
        {
            foreach (DictionaryEntry entry in reader)
            {
                var key = entry.Key as string;
                var image = entry.Value as Image;
                if (key == null || image == null || !MatchesPrefix(key, prefixes)) continue;

                using (image)
                using (var stream = new MemoryStream())
                {
                    image.Save(stream, ImageFormat.Png);
                    var bytes = stream.ToArray();
                    var hash = Hash(bytes);
                    var fileName = hash + ".png";
                    var output = Path.Combine(args[1], fileName);
                    if (!File.Exists(output)) File.WriteAllBytes(output, bytes);
                    entries[key] = "catalog/icons/" + fileName;
                }
            }
        }

        using (var writer = new StreamWriter(args[2], false, new UTF8Encoding(false)))
        {
            writer.WriteLine("{");
            writer.WriteLine("  \"format\": \"mh-save-edit-icon-manifest-v1\",");
            writer.WriteLine("  \"source\": " + Json(Path.GetFileName(args[0])) + ",");
            writer.WriteLine("  \"prefixes\": [" + String.Join(",", Array.ConvertAll(prefixes, Json)) + "],");
            writer.WriteLine("  \"count\": " + entries.Count + ",");
            writer.WriteLine("  \"icons\": {");
            var index = 0;
            foreach (var entry in entries)
            {
                writer.Write("    " + Json(entry.Key) + ": " + Json(entry.Value));
                writer.WriteLine(++index == entries.Count ? "" : ",");
            }
            writer.WriteLine("  }");
            writer.WriteLine("}");
        }

        Console.WriteLine("exported " + entries.Count + " catalog resources");
        return 0;
    }
}

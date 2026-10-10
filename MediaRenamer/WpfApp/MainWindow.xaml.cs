using System.Collections.ObjectModel;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

using MediaRenamer.Core.Models;
using MediaRenamer.Core.Services;

namespace MediaRenamer.WpfApp;

///// <summary>
///// Interaction logic for MainWindow.xaml
///// </summary>
public partial class MainWindow : Window
{
    private readonly FileRenamer _fileRenamer;
    private readonly ObservableCollection<RenamePlanItem> _planItems = new();

    public MainWindow()
    {
        InitializeComponent();

        // Simple manual wiring, no DI container
        var metadataProvider = new ExifMetadataProvider();
        _fileRenamer = new FileRenamer(metadataProvider);

        PlanGrid.ItemsSource = _planItems;
    }

    private void Browse_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new System.Windows.Forms.FolderBrowserDialog();
        var result = dlg.ShowDialog();
        if (result == System.Windows.Forms.DialogResult.OK)
        {
            FolderTextBox.Text = dlg.SelectedPath;
        }
    }

    private void Scan_Click(object sender, RoutedEventArgs e)
    {
        var folder = FolderTextBox.Text;
        if (string.IsNullOrWhiteSpace(folder) || !Directory.Exists(folder))
        {
            System.Windows.Forms.MessageBox.Show("Please select a valid folder.");
            return;
        }

        var pattern = string.IsNullOrWhiteSpace(PatternTextBox.Text)
            ? "yyyyMMdd_HHmmss"
            : PatternTextBox.Text;

        var files = Directory.EnumerateFiles(folder, "*.*", SearchOption.TopDirectoryOnly)
            .Where(f =>
            {
                var ext = System.IO.Path.GetExtension(f).ToLowerInvariant();
                return ext is ".jpg" or ".jpeg" or ".tif" or ".tiff" or ".png" or ".mp4" or ".mov";
            })
            .ToList();

        var plan = _fileRenamer.BuildRenamePlan(files, pattern);

        _planItems.Clear();
        foreach (var item in plan)
            _planItems.Add(item);

        StatusTextBlock.Text = $"Found {plan.Count} files.";
    }

    private void Rename_Click(object sender, RoutedEventArgs e)
    {
        if (_planItems.Count == 0)
        {
            System.Windows.Forms.MessageBox.Show("No rename plan. Run Scan first.");
            return;
        }

        var dryRun = DryRunCheckBox.IsChecked == true;

        _fileRenamer.ApplyRename(_planItems, dryRun);

        StatusTextBlock.Text = dryRun
            ? "Dry run completed. No files renamed."
            : "Rename completed.";
    }
}
/*Note: add reference from MediaRenamer.Wpf to MediaRenamer.Core, and add System.Windows.Forms reference for FolderBrowserDialog (or replace with a WPF file dialog if you prefer).*/